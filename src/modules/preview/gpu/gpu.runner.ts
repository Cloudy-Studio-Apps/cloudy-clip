import { GpuUnavailable } from "./gpu.errors";
import { createPrograms, setSampler, setUniforms } from "./gpu.programs";
import { createTargets } from "./gpu.targets";
import { createDataTextures, createTexture, uploadSource } from "./gpu.textures";
import type { GpuContext, GpuPass, GpuRunner, GpuTarget } from "./gpu.types";

/** What the context is asked for: no depth, no multisampling, colors as they are. */
const CONTEXT: WebGLContextAttributes = {
  alpha: true,
  premultipliedAlpha: false,
  antialias: false,
  depth: false,
  stencil: false,
  preserveDrawingBuffer: false,
  powerPreference: "high-performance",
};

/** A fresh canvas and context with everything the runner keeps on it, or null without WebGL2. */
function openContext(): GpuContext | null {
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl2", CONTEXT);
  if (!gl || gl.isContextLost()) return null;
  const context: GpuContext = {
    canvas,
    gl,
    floatTargets: gl.getExtension("EXT_color_buffer_float") !== null,
    programs: createPrograms(gl),
    targets: createTargets(gl),
    data: createDataTextures(gl),
    source: createTexture(gl),
    lost: false,
  };
  canvas.addEventListener("webglcontextlost", () => {
    context.lost = true;
  });
  return context;
}

/** Frees what a context holds (nothing to free on a lost one) and the context itself. */
function closeContext(context: GpuContext): void {
  const { gl } = context;
  if (!gl.isContextLost()) {
    context.programs.dispose();
    context.targets.dispose();
    context.data.dispose();
    gl.deleteTexture(context.source);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
  context.canvas.width = 0;
  context.canvas.height = 0;
}

/** For each pass, the last pass that reads its output (itself when none does). */
function lastReaders(passes: readonly GpuPass[]): number[] {
  const lastRead = passes.map((_, index) => index);
  passes.forEach((pass, index) =>
    pass.inputs.forEach((input) => {
      if (input >= index) throw new Error(`Pass ${index} reads a later pass`);
      if (input >= 0) lastRead[input] = index;
    }),
  );
  return lastRead;
}

/**
 * Empties texture units 1 to `used - 1` after a draw. A sampler of a shared program keeps the unit
 * it was last pointed at, so a pooled target left bound there (an input on unit 1, say) could be
 * handed out as a later pass's output while that sampler still reads it: a feedback loop, and
 * WebGL drops the draw. Unit 0 is bound to each pass's first input before it draws.
 */
function unbindUnits(gl: WebGL2RenderingContext, used: number): void {
  for (let unit = 1; unit < used; unit++) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }
}

/** Uploads the source and runs the passes on `context`; the last one draws on its canvas. */
function runPasses(
  context: GpuContext,
  picture: TexImageSource,
  width: number,
  height: number,
  passes: readonly GpuPass[],
): void {
  const { gl, canvas, programs, targets, data, source, floatTargets } = context;
  const lastRead = lastReaders(passes);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  uploadSource(gl, source, picture);
  gl.viewport(0, 0, width, height);
  const outputs: GpuTarget[] = [];
  // The most texture units a pass has bound, emptied again however the run ends.
  let used = 0;
  try {
    passes.forEach((pass, index) => {
      const last = index === passes.length - 1;
      // Making a target binds its texture to the active unit, so that is unit 0, bound again to the
      // input below: a data unit left holding the target would be a feedback loop for any sampler
      // of the program still pointing at it from an earlier pass.
      gl.activeTexture(gl.TEXTURE0);
      used = Math.max(used, pass.inputs.length + Object.keys(pass.textures ?? {}).length);
      const target = last ? null : targets.acquire(width, height, floatTargets);
      if (target) outputs[index] = target;
      const found = programs.get(pass);
      gl.useProgram(found.program);
      setUniforms(gl, found, pass);
      pass.inputs.forEach((input, n) => {
        gl.activeTexture(gl.TEXTURE0 + n);
        gl.bindTexture(gl.TEXTURE_2D, input < 0 ? source : outputs[input]!.texture);
      });
      Object.entries(pass.textures ?? {}).forEach(([name, texture], n) => {
        const unit = pass.inputs.length + n;
        gl.activeTexture(gl.TEXTURE0 + unit);
        data.bind(texture);
        setSampler(gl, found, name, unit);
      });
      gl.bindFramebuffer(gl.FRAMEBUFFER, target?.framebuffer ?? null);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      unbindUnits(gl, pass.inputs.length + Object.keys(pass.textures ?? {}).length);
      outputs.forEach((output, read) => {
        if (lastRead[read] === index) {
          targets.release(output);
          delete outputs[read];
        }
      });
    });
  } finally {
    // A pass that threw leaves its targets free for the next run, and none still bound on a unit.
    unbindUnits(gl, used);
    outputs.forEach((output) => targets.release(output));
    data.trim();
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.activeTexture(gl.TEXTURE0);
  }
}

/**
 * Creates a runner with a WebGL2 context of its own, made the first time it is needed. Each
 * engine owns one; nothing else in the app creates a WebGL context. A lost context (a GPU reset,
 * sleep) is made again on the next `run`; when that fails too, the runner is unavailable for good.
 */
export function createGpuRunner(): GpuRunner {
  let context: GpuContext | null = null;
  let failed = false;
  let disposed = false;

  /** The working context, made (again) when there is none or it was lost. */
  function current(): GpuContext | null {
    if (failed || disposed) return null;
    if (context && !context.lost && !context.gl.isContextLost()) return context;
    if (context) closeContext(context);
    // No WebGL2 at all, or a lost context that won't come back: unavailable for good.
    context = openContext();
    if (!context) failed = true;
    return context;
  }

  return {
    get available() {
      return current() !== null;
    },
    get floatTargets() {
      return current()?.floatTargets ?? false;
    },
    run(picture, { width, height }, passes) {
      if (passes.length === 0) throw new Error("Nothing to run");
      const working = current();
      if (!working) throw new GpuUnavailable();
      runPasses(working, picture, width, height, passes);
      if (working.gl.isContextLost()) {
        working.lost = true;
        throw new Error("The graphics context was lost; it is made again on the next frame");
      }
      return working.canvas;
    },
    dispose() {
      disposed = true;
      if (context) closeContext(context);
      context = null;
    },
  };
}

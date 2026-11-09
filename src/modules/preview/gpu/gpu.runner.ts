import { createPrograms, setUniforms } from "./gpu.programs";
import { createTargets } from "./gpu.targets";
import { createTexture, uploadSource } from "./gpu.textures";
import type { GpuRunner, GpuTarget } from "./gpu.types";

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

const UNAVAILABLE: GpuRunner = {
  available: false,
  floatTargets: false,
  run() {
    throw new Error("WebGL2 is not available");
  },
  dispose() {},
};

/**
 * Creates a runner on a WebGL2 context of its own. Each engine owns one; nothing else in the app
 * creates a WebGL context.
 */
export function createGpuRunner(): GpuRunner {
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl2", CONTEXT);
  if (!gl) return UNAVAILABLE;
  const floatTargets = gl.getExtension("EXT_color_buffer_float") !== null;
  const programs = createPrograms(gl);
  const targets = createTargets(gl, floatTargets);
  const source = createTexture(gl);

  return {
    available: true,
    floatTargets,
    run(picture, { width, height }, passes) {
      if (passes.length === 0) throw new Error("Nothing to run");
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      uploadSource(gl, source, picture);
      gl.viewport(0, 0, width, height);
      // A pass's output goes back to the pool after the last pass that reads it.
      const lastRead = passes.map((_, index) => index);
      passes.forEach((pass, index) =>
        pass.inputs.forEach((input) => {
          if (input >= index) throw new Error(`Pass ${index} reads a later pass`);
          if (input >= 0) lastRead[input] = index;
        }),
      );
      const outputs: GpuTarget[] = [];
      passes.forEach((pass, index) => {
        const last = index === passes.length - 1;
        // Making a target binds textures, so it comes before the inputs are bound.
        const target = last ? null : targets.acquire(width, height);
        if (target) outputs[index] = target;
        const found = programs.get(pass);
        gl.useProgram(found.program);
        setUniforms(gl, found, pass);
        pass.inputs.forEach((input, n) => {
          gl.activeTexture(gl.TEXTURE0 + n);
          gl.bindTexture(gl.TEXTURE_2D, input < 0 ? source : outputs[input]!.texture);
        });
        gl.bindFramebuffer(gl.FRAMEBUFFER, target?.framebuffer ?? null);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        outputs.forEach((output, read) => {
          if (lastRead[read] === index) targets.release(output);
        });
      });
      gl.activeTexture(gl.TEXTURE0);
      return canvas;
    },
    dispose() {
      programs.dispose();
      targets.dispose();
      gl.deleteTexture(source);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}

import type { Micros } from "@/core";
import type { FontRequest } from "@/modules/fonts";
import type { Composition, CompositionId, ProjectState } from "@/modules/project";
import type {
  FrameRenderer,
  FrameRendererOptions,
  PreviewCapture,
  PreviewCaptureDeps,
  PreviewEngine,
} from "./preview.types";

/** How long a frame may take to decode. */
const SETTLE_LIMIT_MS = 3000;
/** Pause between looks at the decoders. Timers, not frames: frames stop on a hidden window. */
const SETTLE_POLL_MS = 30;
/** The offscreen engine holds decoders, so it goes once nobody has captured for this long. */
const IDLE_DISPOSE_MS = 30_000;
/** A frame of a renderer may wait for a slow disk or a file that seeks badly. */
const RENDER_SETTLE_LIMIT_MS = 30_000;
/** Going through frames, every wasted pause adds up over the whole video. */
const RENDER_POLL_MS = 4;

/** Draws one moment on `engine` until every layer is in, or fails past `limitMs`. */
async function settle(
  engine: PreviewEngine,
  project: ProjectState,
  composition: Composition,
  time: Micros,
  limitMs: number,
  pollMs: number,
  fontsPending: () => boolean,
  resetFonts: () => void,
): Promise<void> {
  const deadline = performance.now() + limitMs;
  for (;;) {
    resetFonts();
    engine.render(project, composition, time, false);
    const settled = engine.isSettled();
    if (settled && !fontsPending()) return;
    if (performance.now() > deadline) {
      // A font that won't load falls back to Inter; a frame that won't decode has no fallback.
      if (settled) return;
      throw new Error("The frame did not decode in time");
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}

/**
 * Captures frames on an engine of its own, on a canvas that is never shown. It shares nothing
 * with the user's preview, so it doesn't move their playhead, and it works with the window hidden
 * or the preview panel closed.
 */
export function createCapture(deps: PreviewCaptureDeps): PreviewCapture {
  let engine: PreviewEngine | null = null;
  let canvas: HTMLCanvasElement | null = null;
  let waitingForFont = false;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  let queue: Promise<unknown> = Promise.resolve();

  function ensureFont(request: FontRequest): boolean {
    const ready = deps.ensureFont(request);
    if (!ready) waitingForFont = true;
    return ready;
  }

  function drop(): void {
    clearTimeout(idleTimer);
    engine?.dispose();
    engine = null;
    canvas = null;
  }

  async function capture(time: Micros, compositionId: CompositionId): Promise<string> {
    clearTimeout(idleTimer);
    const project = deps.getProject();
    const composition = deps.getComposition(compositionId);
    if (!composition) throw new Error("That composition no longer exists");
    canvas ??= document.createElement("canvas");
    engine ??= deps.createEngine(canvas, ensureFont);
    canvas.width = composition.format.width;
    canvas.height = composition.format.height;

    await settle(
      engine,
      project,
      composition,
      time,
      SETTLE_LIMIT_MS,
      SETTLE_POLL_MS,
      () => waitingForFont,
      () => {
        waitingForFont = false;
      },
    );
    const data = await engine.captureFrame();
    idleTimer = setTimeout(drop, IDLE_DISPOSE_MS);
    return data;
  }

  return {
    captureAt(time, compositionId) {
      const result = queue.then(() => capture(time, compositionId));
      queue = result.catch(() => undefined);
      return result;
    },
    dispose: drop,
  };
}

/** A hidden engine for going through one composition, frame by frame. */
export function createFrameRenderer(
  deps: PreviewCaptureDeps,
  { project, compositionId, ...options }: FrameRendererOptions,
): FrameRenderer {
  const composition = project.compositions[compositionId];
  if (!composition) throw new Error("That composition no longer exists");
  let waitingForFont = false;
  const ensureFont = (request: FontRequest) => {
    const ready = deps.ensureFont(request);
    if (!ready) waitingForFont = true;
    return ready;
  };
  const canvas = document.createElement("canvas");
  canvas.width = composition.format.width;
  canvas.height = composition.format.height;
  const engine = deps.createEngine(canvas, ensureFont, options);
  return {
    async frameAt(time) {
      await settle(
        engine,
        project,
        composition,
        time,
        RENDER_SETTLE_LIMIT_MS,
        RENDER_POLL_MS,
        () => waitingForFont,
        () => {
          waitingForFont = false;
        },
      );
      return engine.readPixels();
    },
    dispose: () => engine.dispose(),
  };
}

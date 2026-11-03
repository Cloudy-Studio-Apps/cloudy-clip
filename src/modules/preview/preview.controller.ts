import { createLogger, LOCAL_ACTOR, type ActorId } from "@/core";
import type { ClipId, ClipTransform } from "@/modules/project";
import { createVirtualClock } from "./logic/virtual.clock";
import { createPreviewSound } from "./preview.sound";
import type {
  PlaybackClock,
  PreviewController,
  PreviewControllerDeps,
  PreviewEngine,
} from "./preview.types";
import { createViewport } from "./preview.viewport";

const log = createLogger("preview");

/** While paused, frames still decoding are retried for at most this many animation frames. */
const MAX_SETTLE_RETRIES = 180;

/**
 * Creates the preview controller of one kernel. Rendering follows the clock while playing and
 * redraws on demand while paused (no idle CPU use).
 */
export function createPreviewController(deps: PreviewControllerDeps): PreviewController {
  const { clock } = deps;
  let engine: PreviewEngine | null = null;
  /** Canvases attached, oldest first. Only the newest is drawn on, so two never fight. */
  const attached: HTMLCanvasElement[] = [];
  let stopEngine: (() => void) | null = null;
  let redrawQueued = false;
  let settleRetries = 0;
  /** Live transforms of a gesture in progress, drawn instead of the saved ones. */
  const transforms = new Map<ClipId, ClipTransform>();

  /** Live patches of clips' values, drawn over the saved ones. */
  const propsOverrides = new Map<ClipId, Record<string, unknown>>();

  const overrideListeners = new Set<(clipId: ClipId) => void>();

  /** Collaborators' playheads, made when first used. */
  const clocks = new Map<ActorId, PlaybackClock>();

  /** Live mix values, solo and the monitor: the engine attached later starts with them too. */
  const sound = createPreviewSound(() => engine);

  function renderNow(): void {
    redrawQueued = false;
    if (!engine) return;
    const composition = deps.getComposition();
    if (!composition) {
      engine.pauseAll();
      return;
    }
    try {
      engine.render(
        deps.getProject(),
        composition,
        clock.getTime(),
        clock.isPlaying(),
        transforms,
        propsOverrides,
      );
    } catch (error) {
      log.error("Render failed", error);
    }
    // A layer is still decoding: try again next frame (bounded, so a stuck file can't spin).
    if (!clock.isPlaying() && !engine.isSettled() && settleRetries < MAX_SETTLE_RETRIES) {
      settleRetries++;
      scheduleRedraw();
    }
  }

  function scheduleRedraw(): void {
    if (redrawQueued || clock.isPlaying()) return;
    redrawQueued = true;
    deps.requestFrame(renderNow);
  }

  /** Schedules one redraw on the next frame (coalesces bursts of events). */
  function requestRedraw(): void {
    settleRetries = 0;
    scheduleRedraw();
  }

  /**
   * Makes the kernel's one engine, on its first canvas, following the clock and the project.
   * Returns what stops it, when no canvas is left (the app going away).
   */
  function start(canvas: HTMLCanvasElement): () => void {
    const current = deps.createEngine(canvas, requestRedraw);
    current.setSound(sound.current());
    engine = current;

    const offTime = clock.onTime(() => {
      if (clock.isPlaying()) renderNow();
      else requestRedraw();
    });
    const offPlaying = clock.onPlayingChange(() => {
      if (!clock.isPlaying()) engine?.pauseAll();
      requestRedraw();
    });
    // Keep the playhead inside the timeline when clips are removed or trimmed.
    const offProject = deps.subscribeProject(() => {
      const duration = deps.getDuration();
      if (clock.getTime() > duration) clock.seek(duration);
      requestRedraw();
    });
    // A proxy becoming ready changes a file's URL; redraw so the engine reloads it.
    const offMedia = deps.subscribeMedia(requestRedraw);

    return () => {
      offTime();
      offPlaying();
      offProject();
      offMedia();
      if (engine === current) engine = null;
      current.dispose();
    };
  }

  /**
   * The engine draws on the newest attached canvas only, so two never fight. Moving to another
   * canvas keeps the engine, its media elements and its sound graph: playback goes on without a
   * gap and the loudness keeps counting. The engine goes only when no canvas is left.
   */
  function drawOnTop(): void {
    const top = attached.at(-1);
    if (!top) {
      stopEngine?.();
      stopEngine = null;
      return;
    }
    if (engine) engine.setCanvas(top);
    else stopEngine = start(top);
    requestRedraw();
  }

  function attachCanvas(canvas: HTMLCanvasElement): () => void {
    attached.push(canvas);
    drawOnTop();
    let done = false;
    return () => {
      if (done) return;
      done = true;
      attached.splice(attached.lastIndexOf(canvas), 1);
      drawOnTop();
    };
  }

  return {
    playback: clock,
    clockFor(actor) {
      if (actor === LOCAL_ACTOR) return clock;
      let virtual = clocks.get(actor);
      if (!virtual) {
        virtual = createVirtualClock(() => deps.getDuration(actor), clock.getTime());
        clocks.set(actor, virtual);
      }
      return virtual;
    },
    dropClock(actor) {
      clocks.get(actor)?.dispose();
      clocks.delete(actor);
    },
    attachCanvas,
    redraw: requestRedraw,
    captureAt: (time, compositionId) => deps.capture.captureAt(time, compositionId),
    createRenderer: (options) => deps.createRenderer(options),
    measureVideoLevels: (url) => deps.measureVideoLevels(url),
    previewTransform(clipId, transform) {
      if (transform) transforms.set(clipId, transform);
      else transforms.delete(clipId);
      requestRedraw();
    },
    previewProps(clipId, patch) {
      if (patch) propsOverrides.set(clipId, patch);
      else propsOverrides.delete(clipId);
      requestRedraw();
      overrideListeners.forEach((listener) => listener(clipId));
    },
    onPropsOverride(listener) {
      overrideListeners.add(listener);
      return () => void overrideListeners.delete(listener);
    },
    propsOverride: (clipId) => propsOverrides.get(clipId),
    viewport: createViewport(),
    sound: sound.sound,
    dispose() {
      clock.pause();
      attached.length = 0;
      drawOnTop();
      deps.capture.dispose();
      for (const virtual of clocks.values()) virtual.dispose();
      clocks.clear();
    },
  };
}

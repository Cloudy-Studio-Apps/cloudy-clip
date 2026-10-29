import { afterEach, describe, expect, it, vi } from "vitest";
import { createEmptyProject } from "@/modules/project";
import { createPlaybackClock } from "./preview.clock";
import { createPreviewController } from "./preview.controller";
import type { PreviewEngine } from "./preview.types";

interface FakeEngine extends PreviewEngine {
  renders: number;
  disposed: boolean;
  settled: boolean;
}

function fakeEngine(): FakeEngine {
  const engine: FakeEngine = {
    renders: 0,
    disposed: false,
    settled: true,
    render: () => void engine.renders++,
    pauseAll: () => {},
    isSettled: () => engine.settled,
    captureFrame: () => "png",
    dispose: () => void (engine.disposed = true),
  };
  return engine;
}

function setup() {
  const frames: Array<() => void> = [];
  const projectListeners = new Set<() => void>();
  const mediaListeners = new Set<() => void>();
  const engines: FakeEngine[] = [];
  const clock = createPlaybackClock(() => 10_000_000);
  const controller = createPreviewController({
    clock,
    getProject: createEmptyProject,
    getDuration: () => 10_000_000,
    subscribeProject: (listener) => {
      projectListeners.add(listener);
      return () => projectListeners.delete(listener);
    },
    subscribeMedia: (listener) => {
      mediaListeners.add(listener);
      return () => mediaListeners.delete(listener);
    },
    createEngine: () => {
      const engine = fakeEngine();
      engines.push(engine);
      return engine;
    },
    requestFrame: (cb) => void frames.push(cb),
  });
  const flush = () => {
    for (let i = 0; i < 1000 && frames.length > 0; i++) frames.shift()?.();
  };
  const notify = (listeners: Set<() => void>) => listeners.forEach((l) => l());
  return { clock, controller, engines, flush, frames, projectListeners, mediaListeners, notify };
}

const canvas = {} as HTMLCanvasElement;

afterEach(() => vi.unstubAllGlobals());

describe("preview controller", () => {
  it("attach, detach, attach leaves one live engine", () => {
    const { controller, engines, flush, notify, projectListeners } = setup();
    const detach = controller.attachCanvas(canvas);
    detach();
    controller.attachCanvas(canvas);
    flush();
    const [first, second] = engines;
    expect(first?.disposed).toBe(true);
    expect(second?.disposed).toBe(false);

    const before = { first: first?.renders, second: second?.renders };
    notify(projectListeners);
    flush();
    expect(first?.renders).toBe(before.first);
    expect(second?.renders).toBe((before.second ?? 0) + 1);
  });

  it("retries while unsettled when paused, at most 180 times", () => {
    const { controller, engines, flush, frames } = setup();
    controller.attachCanvas(canvas);
    const engine = engines[0];
    if (!engine) throw new Error("no engine");
    engine.settled = false;
    engine.renders = 0;
    controller.redraw();
    flush();
    expect(engine.renders).toBe(181);
    expect(frames).toHaveLength(0);
  });

  it("dispose pauses the clock and drops every subscription", () => {
    vi.stubGlobal("requestAnimationFrame", () => 1);
    vi.stubGlobal("cancelAnimationFrame", () => {});
    const { clock, controller, engines, flush, notify, projectListeners, mediaListeners } = setup();
    controller.attachCanvas(canvas);
    flush();
    clock.play();
    controller.dispose();
    expect(clock.isPlaying()).toBe(false);
    expect(projectListeners.size).toBe(0);
    expect(mediaListeners.size).toBe(0);
    const engine = engines[0];
    const renders = engine?.renders;
    notify(projectListeners);
    flush();
    expect(engine?.renders).toBe(renders);
    expect(engine?.disposed).toBe(true);
  });

  it("captureFrame rejects when no canvas is attached", async () => {
    const { controller } = setup();
    await expect(controller.captureFrame()).rejects.toThrow("The preview is not visible");
  });

  it("keeps a live text override until cleared and redraws", () => {
    const { controller, engines, flush } = setup();
    controller.attachCanvas(canvas);
    flush();
    const before = engines[0]?.renders ?? 0;
    controller.previewTextClip("c1", { text: "Hi" });
    expect(controller.textClipOverride("c1")).toEqual({ text: "Hi" });
    flush();
    expect(engines[0]?.renders).toBe(before + 1);
    controller.previewTextClip("c1", null);
    expect(controller.textClipOverride("c1")).toBeUndefined();
  });
});

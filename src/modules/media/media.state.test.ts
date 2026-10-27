import { afterEach, describe, expect, it, vi } from "vitest";
import { createMediaState } from "./media.store";

afterEach(() => vi.useRealTimers());

describe("media state", () => {
  it("setProxy keeps the earlier message when progress omits it", () => {
    const media = createMediaState();
    media.setProxy("m", { state: "queued", message: "ProRes is not playable" });
    media.setProxy("m", { state: "encoding", progress: 0.5 });
    expect(media.getProbe("m")?.proxy).toEqual({
      state: "encoding",
      progress: 0.5,
      message: "ProRes is not playable",
    });
  });

  it("waitForProbe resolves on ready and on timeout", async () => {
    vi.useFakeTimers();
    const media = createMediaState();
    media.setProbe("a", { status: "pending" });
    const ready = media.waitForProbe("a", 1000);
    media.setProbe("a", { status: "ready", duration: 5 });
    await expect(ready).resolves.toMatchObject({ status: "ready", duration: 5 });

    media.setProbe("b", { status: "pending" });
    const timedOut = media.waitForProbe("b", 1000);
    vi.advanceTimersByTime(1000);
    await expect(timedOut).resolves.toMatchObject({ status: "pending" });
  });

  it("two media states are independent", () => {
    const first = createMediaState();
    const second = createMediaState();
    first.setProbe("m", { status: "ready" });
    first.fileDrop.setState({ active: true });
    expect(second.getProbe("m")).toBeUndefined();
    expect(second.fileDrop.getState().active).toBe(false);
  });
});

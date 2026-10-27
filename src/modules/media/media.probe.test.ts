import { describe, expect, it } from "vitest";
import type { MediaAsset } from "@/modules/project";
import { createProbeQueue } from "./media.probe";
import { createMediaState } from "./media.store";

const asset = (id: string): MediaAsset => ({
  id,
  name: id,
  path: `/${id}`,
  kind: "video",
  size: 1,
});

describe("probe queue", () => {
  it("stops starting and writing once disposed", async () => {
    const state = createMediaState();
    const queue = createProbeQueue({ state, mediaUrl: (id) => `fake://${id}` });
    queue.enqueue(asset("a"));
    queue.enqueue(asset("b"));
    queue.enqueue(asset("c"));
    queue.dispose();
    // In node, probing fails (no DOM); a live queue would mark a/b as errors and start c.
    await new Promise((resolve) => setTimeout(resolve, 0));
    for (const id of ["a", "b", "c"]) expect(state.getProbe(id)?.status).toBe("pending");

    queue.enqueue(asset("d"));
    expect(state.getProbe("d")).toBeUndefined();
  });
});

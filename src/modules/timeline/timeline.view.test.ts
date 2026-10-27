import { describe, expect, it } from "vitest";
import { createTimelineView } from "./timeline.store";

describe("timeline view", () => {
  it("clamps zoom to 2..400", () => {
    const timeline = createTimelineView();
    timeline.setZoom(1);
    expect(timeline.view.getState().pxPerSecond).toBe(2);
    timeline.setZoom(1000);
    expect(timeline.view.getState().pxPerSecond).toBe(400);
  });

  it("selectClip replaces, toggles with additive, and clears with null", () => {
    const timeline = createTimelineView();
    const selection = () => timeline.view.getState().selection;
    timeline.selectClip("a");
    timeline.selectClip("b");
    expect(selection()).toEqual(["b"]);
    timeline.selectClip("a", true);
    expect(selection()).toEqual(["b", "a"]);
    timeline.selectClip("b", true);
    expect(selection()).toEqual(["a"]);
    timeline.selectClip(null);
    expect(selection()).toEqual([]);
  });

  it("two views are independent", () => {
    const first = createTimelineView();
    const second = createTimelineView();
    first.selectClip("a");
    first.setZoom(100);
    expect(second.view.getState()).toEqual({ pxPerSecond: 60, selection: [] });
  });
});

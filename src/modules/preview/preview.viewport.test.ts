import { describe, expect, it } from "vitest";
import { createViewport, MAX_ZOOM, zoomAround } from "./preview.viewport";

describe("zoomAround", () => {
  it("keeps the point under the anchor still", () => {
    const next = zoomAround({ zoom: 1, panX: 0, panY: 0 }, 2, { x: 100, y: -40 });
    expect(next).toEqual({ zoom: 2, panX: -100, panY: 40 });
    // The frame point that was at the anchor (100 px right of the frame center at zoom 1)
    // is now 200 px right of the frame center, which sits at -100: still at x = 100.
    expect(next.panX + 100 * next.zoom).toBe(100);
  });

  it("clamps the zoom and moves the pan only as much as the zoom changed", () => {
    const next = zoomAround({ zoom: MAX_ZOOM, panX: 10, panY: 0 }, 2, { x: 50, y: 0 });
    expect(next).toEqual({ zoom: MAX_ZOOM, panX: 10, panY: 0 });
  });
});

describe("createViewport", () => {
  it("pans and fits back", () => {
    const viewport = createViewport();
    viewport.zoomBy(2);
    viewport.panBy(30, -5);
    expect(viewport.store.getState()).toEqual({ zoom: 2, panX: 30, panY: -5 });
    viewport.fit();
    expect(viewport.store.getState()).toEqual({ zoom: 1, panX: 0, panY: 0 });
  });
});

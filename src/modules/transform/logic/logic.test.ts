import { describe, expect, it } from "vitest";
import { createEmptyProject, IDENTITY_TRANSFORM, type ClipPlacement } from "@/modules/project";
import { moveTransform, rotateTransform, scaleTransform } from "./gestures";
import { screenToFrame } from "./frame";
import { containsPoint, topmostAt } from "./picking";
import { visibleLayers } from "./layers";

const box: ClipPlacement = { cx: 100, cy: 100, width: 100, height: 20, rotation: 0 };

describe("hit test", () => {
  it("follows the rotation of the picture", () => {
    expect(containsPoint(box, { x: 140, y: 100 })).toBe(true);
    expect(containsPoint(box, { x: 100, y: 140 })).toBe(false);
    const upright = { ...box, rotation: 90 };
    expect(containsPoint(upright, { x: 140, y: 100 })).toBe(false);
    expect(containsPoint(upright, { x: 100, y: 140 })).toBe(true);
  });

  it("finds the top-most layer", () => {
    const under = { ...box, width: 400, height: 400 };
    expect(topmostAt([box, under], { x: 100, y: 100 })).toBe(0);
    expect(topmostAt([box, under], { x: 250, y: 250 })).toBe(1);
    expect(topmostAt([box, under], { x: 900, y: 900 })).toBe(-1);
  });
});

describe("gesture math", () => {
  it("moves and snaps to the center", () => {
    expect(moveTransform(IDENTITY_TRANSFORM, { x: 30, y: 4 }, 5)).toEqual({
      transform: { x: 30, y: 0, scale: 1, rotation: 0 },
      snappedX: false,
      snappedY: true,
    });
  });

  it("scales by the pointer's distance from the center", () => {
    const next = scaleTransform(
      IDENTITY_TRANSFORM,
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 0, y: 25 },
    );
    expect(next.scale).toBe(2.5);
  });

  it("rotates by the swept angle, snapping with a step", () => {
    const c = { x: 0, y: 0 };
    expect(rotateTransform(IDENTITY_TRANSFORM, c, { x: 1, y: 0 }, { x: 0, y: 1 }).rotation).toBe(
      90,
    );
    const near = { x: Math.cos(0.3), y: Math.sin(0.3) }; // ~17°
    expect(rotateTransform(IDENTITY_TRANSFORM, c, { x: 1, y: 0 }, near, 15).rotation).toBe(15);
  });
});

describe("screenToFrame", () => {
  it("maps screen pixels to output pixels at any zoom", () => {
    const format = { width: 1080, height: 1920, fps: 30 };
    const rect = { left: 100, top: 50, width: 270, height: 480 };
    expect(screenToFrame(rect, format, 235, 290)).toEqual({ x: 540, y: 960 });
  });
});

describe("visibleLayers", () => {
  it("lists on-screen video clips top-most first", () => {
    const state = createEmptyProject();
    const [top, audio] = state.trackOrder;
    const lower = "lower";
    state.tracks[lower] = {
      id: lower,
      kind: "video",
      name: "V0",
      clipIds: [],
      muted: false,
      hidden: false,
    };
    state.trackOrder = [top!, lower, audio!];
    state.media.m = { id: "m", name: "m.mp4", path: "/m.mp4", kind: "video", size: 1 };
    state.clips.a = { id: "a", trackId: top!, mediaId: "m", start: 0, sourceIn: 0, duration: 10 };
    state.clips.b = { id: "b", trackId: lower, mediaId: "m", start: 5, sourceIn: 0, duration: 10 };
    state.tracks[top!]!.clipIds = ["a"];
    state.tracks[lower]!.clipIds = ["b"];
    const size = () => ({ width: 1920, height: 1080 });
    const measure = (text: string) => text.length * 50;
    expect(visibleLayers(state, size, 7, measure).map((l) => l.clipId)).toEqual(["a", "b"]);
    expect(visibleLayers(state, size, 12, measure).map((l) => l.clipId)).toEqual(["b"]);
    expect(visibleLayers(state, () => undefined, 7, measure)).toEqual([]);
  });

  it("lists text clips with their measured box, kept at natural size", () => {
    const state = createEmptyProject();
    const top = state.trackOrder[0]!;
    state.clips.t = {
      id: "t",
      kind: "text",
      text: "Text",
      trackId: top,
      start: 0,
      sourceIn: 0,
      duration: 10,
    };
    state.tracks[top]!.clipIds = ["t"];
    const [layer] = visibleLayers(
      state,
      () => undefined,
      5,
      (text) => text.length * 50,
    );
    expect(layer).toMatchObject({ clipId: "t", fit: "none" });
    expect(layer!.source.width).toBeGreaterThan(200);
  });
});

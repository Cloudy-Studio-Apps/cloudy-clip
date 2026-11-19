import { describe, expect, it } from "vitest";
import { clipTransform, IDENTITY_TRANSFORM } from "../project.geometry";
import type { Clip, MotionPath, PathPoint } from "../project.types";
import { bakeFollow, followedClip } from "./follow";

const corner = (x: number, y: number): PathPoint => ({ x, y, inX: 0, inY: 0, outX: 0, outY: 0 });
const pathTo = (x: number, y: number): MotionPath => ({
  id: "p",
  compositionId: "c1",
  name: "Path 1",
  closed: false,
  points: [corner(0, 0), corner(x, y)],
});
const right = { p: pathTo(100, 0) };
const down = { p: pathTo(0, 100) };

function follower(extra: Partial<Clip> = {}): Clip {
  return {
    id: "a",
    kind: "text",
    trackId: "t1",
    start: 0,
    sourceIn: 0,
    duration: 1_000_000,
    props: {},
    transform: { ...IDENTITY_TRANSFORM, x: 10 },
    follow: { pathId: "p", progress: 0.5, orient: false },
    ...extra,
  };
}

describe("followedClip", () => {
  it("a follower sits at its offset plus the path point", () => {
    expect(clipTransform(followedClip(follower(), 0, right)).x).toBeCloseTo(60);
  });

  it("orient adds the direction to rotation", () => {
    const clip = follower({
      transform: { ...IDENTITY_TRANSFORM, rotation: 5 },
      follow: { pathId: "p", progress: 0.5, orient: true },
    });
    expect(clipTransform(followedClip(clip, 0, down)).rotation).toBeCloseTo(95);
  });

  it("live values apply before the path", () => {
    const live = { transform: { x: 20 }, follow: { progress: 1 } };
    expect(clipTransform(followedClip(follower(), 0, right, live)).x).toBeCloseTo(120);
  });

  it("a missing path leaves the clip at its offset", () => {
    expect(clipTransform(followedClip(follower(), 0, {})).x).toBe(10);
    expect(clipTransform(followedClip(follower(), 0, undefined)).x).toBe(10);
  });
});

describe("bakeFollow", () => {
  it("bake keeps the clip where it was", () => {
    const clip = follower({
      follow: { pathId: "p", progress: 0, orient: false },
      animation: {
        "follow.progress": {
          blend: "number",
          shared: true,
          min: -10,
          max: 10,
          keys: [
            { id: "k1", t: 0, value: 0 },
            { id: "k2", t: 999_999, value: 1 },
          ],
        },
      },
    });
    const at = 500_000;
    const before = clipTransform(followedClip(clip, at, right));
    const baked = bakeFollow(clip, right, at);
    const after = clipTransform(followedClip(baked, at, right));
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
    expect(baked.follow).toBeUndefined();
    expect(baked.animation?.["follow.progress"]).toBeUndefined();
  });
});

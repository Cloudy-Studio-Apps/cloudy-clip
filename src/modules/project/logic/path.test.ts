import { describe, expect, it } from "vitest";
import type { MotionPath, PathPoint } from "../project.types";
import { pathLength, pathPointAt } from "./path";

const corner = (x: number, y: number, extra: Partial<PathPoint> = {}): PathPoint => ({
  x,
  y,
  inX: 0,
  inY: 0,
  outX: 0,
  outY: 0,
  ...extra,
});
const open = (points: PathPoint[], closed = false): MotionPath => ({
  id: "p",
  compositionId: "c1",
  name: "Path 1",
  closed,
  points,
});
const line = open([corner(0, 0), corner(100, 0)]);
const arc = open([corner(0, 0, { outY: -100 }), corner(100, 0, { inY: -100 })]);

function distance(path: MotionPath, from: number, to: number): number {
  let total = 0;
  let last = pathPointAt(path, from);
  for (let i = 1; i <= 200; i++) {
    const here = pathPointAt(path, from + ((to - from) * i) / 200);
    total += Math.hypot(here.x - last.x, here.y - last.y);
    last = here;
  }
  return total;
}

describe("pathPointAt", () => {
  it("a straight path is half way at 0.5", () => {
    const at = pathPointAt(line, 0.5);
    expect(at.x).toBeCloseTo(50);
    expect(at.y).toBeCloseTo(0);
    expect(at.angle).toBeCloseTo(0);
    expect(pathLength(line)).toBeCloseTo(100);
  });

  it("speed is even along a curve", () => {
    const first = distance(arc, 0, 0.25);
    const second = distance(arc, 0.25, 0.5);
    expect(Math.abs(first - second) / first).toBeLessThan(0.01);
  });

  it("an open path holds its ends", () => {
    expect(pathPointAt(line, 1.5)).toMatchObject({ x: 100, y: 0 });
    expect(pathPointAt(line, -1)).toMatchObject({ x: 0, y: 0 });
  });

  it("a closed path wraps", () => {
    const triangle = open([corner(0, 0), corner(100, 0), corner(0, 100)], true);
    const a = pathPointAt(triangle, 1.25);
    const b = pathPointAt(triangle, 0.25);
    expect(a.x).toBeCloseTo(b.x);
    expect(a.y).toBeCloseTo(b.y);
  });

  it("angle points down a downward segment", () => {
    expect(pathPointAt(open([corner(0, 0), corner(0, 100)]), 0.3).angle).toBeCloseTo(90);
  });
});

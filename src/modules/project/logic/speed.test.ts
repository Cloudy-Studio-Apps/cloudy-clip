import { describe, expect, it } from "vitest";
import { sourceSpan, sourceTimeAt } from "./speed";

const S = 1_000_000;
const clip = { start: 5 * S, sourceIn: 2 * S, duration: 4 * S };
const at = (rate: number) => ({ ...clip, speed: { rate, pitchCorrection: true, reversed: false } });

describe("clip time", () => {
  it("maps time at 1x as before", () => {
    expect(sourceTimeAt(clip, 6 * S)).toBe(3 * S);
  });

  it("maps time at 2x", () => {
    expect(sourceTimeAt(at(2), 6 * S)).toBe(4 * S);
  });

  it("gives integer micros at 3x", () => {
    expect(Number.isInteger(sourceTimeAt(at(1 / 3), 5 * S + 1))).toBe(true);
  });

  it("stays inside the clip's part of the file", () => {
    expect(sourceTimeAt(at(2), 20 * S)).toBe(2 * S + 8 * S);
  });

  it("sourceSpan is the duration times the rate", () => {
    expect(sourceSpan(at(2))).toBe(8 * S);
    expect(sourceSpan(clip)).toBe(4 * S);
  });

  it("a hold stays on one frame", () => {
    expect(sourceTimeAt(at(0), 8 * S)).toBe(2 * S);
  });
});

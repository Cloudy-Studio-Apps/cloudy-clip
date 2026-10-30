import { describe, expect, it } from "vitest";
import { bump, clamp01, easeInOutCubic, easeInOutQuint } from "./easing";

describe("easeInOutQuint", () => {
  it("runs from 0 to 1 through 0.5, slowly at the ends", () => {
    expect(easeInOutQuint(0)).toBe(0);
    expect(easeInOutQuint(0.5)).toBe(0.5);
    expect(easeInOutQuint(1)).toBe(1);
    expect(easeInOutQuint(0.2)).toBeLessThan(0.01);
  });
});

describe("clamp01", () => {
  it("limits to 0..1", () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(0.4)).toBe(0.4);
    expect(clamp01(2)).toBe(1);
  });
});

describe("easing", () => {
  it("easeInOutCubic hits 0, 0.5 and 1", () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(0.5)).toBe(0.5);
    expect(easeInOutCubic(1)).toBe(1);
  });
  it("bump is 0 at the ends and 1 in the middle", () => {
    expect(bump(0)).toBe(0);
    expect(bump(1)).toBe(0);
    expect(bump(0.5)).toBe(1);
  });
});

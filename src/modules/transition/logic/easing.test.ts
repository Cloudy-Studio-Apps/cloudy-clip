import { describe, expect, it } from "vitest";
import { bump, easeInOutCubic } from "./easing";

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

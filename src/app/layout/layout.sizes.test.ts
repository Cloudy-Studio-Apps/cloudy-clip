import { describe, expect, it } from "vitest";
import type { ResizeRule } from "./layout.types";
import { clampSize, RESIZE_RULES } from "./layout.sizes";

describe("clampSize", () => {
  const side = RESIZE_RULES.side;

  it("keeps sizes inside the rule's limits", () => {
    expect(clampSize(side, 100)).toBe(260);
    expect(clampSize(side, 9999)).toBe(600);
    expect(clampSize(side, 400.4)).toBe(400);
  });

  it("falls back to the minimum when the maximum is smaller (tiny windows)", () => {
    const rule: ResizeRule = { ...side, max: () => 50 };
    expect(clampSize(rule, 300)).toBe(260);
  });
});

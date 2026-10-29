import { describe, expect, it } from "vitest";
import { canvasTextMeasure } from "./measure";

describe("canvasTextMeasure", () => {
  it("takes off the trailing spacing the canvas adds", () => {
    const ctx = {
      font: "",
      letterSpacing: "0px",
      measureText: (t: string) => ({
        width: t.length * 10 + t.length * parseFloat(ctx.letterSpacing),
      }),
    };
    expect(canvasTextMeasure(ctx)("abc", "16px x", 4)).toBe(30 + 8);
    expect(canvasTextMeasure(ctx)("abc", "16px x", 0)).toBe(30);
  });

  it("measures letter by letter without ctx.letterSpacing", () => {
    const ctx = { font: "", measureText: (t: string) => ({ width: t.length * 10 }) };
    expect(canvasTextMeasure(ctx)("abc", "16px x", 4)).toBe(38);
    expect(canvasTextMeasure(null)("abc", "16px x", 4)).toBe(0);
  });
});

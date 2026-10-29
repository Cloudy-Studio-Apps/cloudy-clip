import { describe, expect, it } from "vitest";
import { withAlpha } from "./color";

describe("withAlpha", () => {
  it("converts hex to rgba", () => {
    expect(withAlpha("#ff8000", 0.5)).toBe("rgba(255, 128, 0, 0.5)");
    expect(withAlpha("#fff", 2)).toBe("rgba(255, 255, 255, 1)");
  });
});

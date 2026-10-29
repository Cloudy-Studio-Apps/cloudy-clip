import { describe, expect, it } from "vitest";
import { bundledCssFamily, cssFontFamily } from "./css";

describe("fonts", () => {
  it("quotes and escapes families", () => {
    expect(cssFontFamily({ family: 'O\'Font "X"', source: "google" })).toMatch(/^"O'Font \\"X\\""/);
    expect(cssFontFamily({ family: "Source Sans 3", source: "google" })).toMatch(
      /^"Source Sans 3"/,
    );
    expect(cssFontFamily({ family: "Inter", source: "bundled" })).toContain("Inter Variable");
  });
});

describe("bundledCssFamily", () => {
  it("maps bundled family names", () => {
    expect(bundledCssFamily("Inter")).toBe("Inter Variable");
    expect(bundledCssFamily("Other")).toBe("Other");
  });
});

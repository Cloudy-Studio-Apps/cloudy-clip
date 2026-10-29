import { describe, expect, it } from "vitest";
import { fromDisplay, toDisplay } from "./display";

describe("display scale", () => {
  it("shows stored values scaled and reads them back", () => {
    expect(toDisplay(0.6, { scale: 100, unit: "%" })).toBe(60);
    expect(fromDisplay(60, { scale: 100, unit: "%" })).toBe(0.6);
  });
  it("leaves values alone without a scale", () => {
    expect(toDisplay(12, undefined)).toBe(12);
    expect(fromDisplay(12, {})).toBe(12);
  });
});

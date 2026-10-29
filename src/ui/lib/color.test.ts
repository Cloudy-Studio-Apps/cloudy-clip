import { describe, expect, it } from "vitest";
import { hexToHsv, hsvToHex, normalizeHex } from "./color";

describe("normalizeHex", () => {
  it("expands and lowercases", () => {
    expect(normalizeHex("ABC")).toBe("#aabbcc");
    expect(normalizeHex("#abc")).toBe("#aabbcc");
    expect(normalizeHex(" #AABBCC ")).toBe("#aabbcc");
  });
  it("rejects bad input", () => {
    expect(normalizeHex("#12345")).toBeNull();
    expect(normalizeHex("#ggg")).toBeNull();
    expect(normalizeHex("")).toBeNull();
  });
});

describe("hsv", () => {
  it("round-trips", () => {
    expect(hsvToHex(hexToHsv("#f2a385"))).toBe("#f2a385");
    expect(hsvToHex(hexToHsv("#1f2430"))).toBe("#1f2430");
  });
  it("reads pure red and black", () => {
    expect(hexToHsv("#ff0000")).toEqual({ h: 0, s: 1, v: 1 });
    expect(hexToHsv("#000000").v).toBe(0);
  });
});

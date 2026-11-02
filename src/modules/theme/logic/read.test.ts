import { describe, expect, it } from "vitest";
import { readTheme } from "./read";

const base = {
  id: "t",
  label: "T",
  appearance: "dark",
  preview: { background: "#000", surface: "#111", primary: "#222", foreground: "#fff" },
};

describe("readTheme", () => {
  it("refuses a value that could load from the network", () => {
    expect(() =>
      readTheme({ ...base, tokens: { surface: "url(https://x.test/a.png)" } }),
    ).toThrow();
    expect(() => readTheme({ ...base, tokens: { surface: "@import 'x'" } })).toThrow();
    expect(() => readTheme({ ...base, fonts: { sans: "URL(x)" } })).toThrow();
  });

  it("refuses a value that could end the declaration", () => {
    expect(() =>
      readTheme({ ...base, tokens: { surface: "red; } body { display: none" } }),
    ).toThrow();
  });

  it("leaves out unknown tokens and reports them", () => {
    expect(readTheme({ ...base, tokens: { "canvas-grid": "#000" } }).ignored).toEqual([
      "canvas-grid",
    ]);
  });
});

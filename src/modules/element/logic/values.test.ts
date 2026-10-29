import { describe, expect, it } from "vitest";
import { getPath, mergeProps, minimizeProps, resolveProps } from "./values";

describe("mergeProps", () => {
  it("merges groups one level deep and skips undefined", () => {
    expect(
      mergeProps(
        { size: 1, outline: { enabled: false, width: 8 } },
        { outline: { enabled: true, width: undefined }, size: undefined },
      ),
    ).toEqual({ size: 1, outline: { enabled: true, width: 8 } });
  });
});

describe("minimizeProps", () => {
  const defaults = { size: 96, outline: { enabled: false, width: 8 } };
  it("drops fields equal to their default and empty groups", () => {
    expect(minimizeProps({ size: 96, outline: { enabled: true, width: 8 } }, defaults)).toEqual({
      outline: { enabled: true },
    });
    expect(minimizeProps(defaults, defaults)).toEqual({});
  });
  it("compares object values by content", () => {
    expect(
      minimizeProps(
        { font: { family: "Inter", source: "bundled" } },
        {
          font: { family: "Inter", source: "bundled" },
        },
      ),
    ).toEqual({});
  });
  it("round-trips through resolveProps", () => {
    const full = { size: 40, outline: { enabled: true, width: 8 } };
    expect(resolveProps(minimizeProps(full, defaults), defaults)).toEqual(full);
  });
});

describe("resolveProps", () => {
  const defaults = (f: { width: number; height: number }) => ({
    size: Math.round(Math.min(f.width, f.height) * 0.09),
  });
  it("lets unstored fields follow the format's defaults", () => {
    expect(resolveProps({}, defaults({ width: 1080, height: 1920 })).size).toBe(97);
    expect(resolveProps({}, defaults({ width: 640, height: 360 })).size).toBe(32);
    expect(resolveProps({ size: 40 }, defaults({ width: 640, height: 360 })).size).toBe(40);
  });
});

describe("getPath", () => {
  it("reads nested values", () => {
    expect(getPath({ a: { b: 2 } }, "a.b")).toBe(2);
    expect(getPath({ a: 1 }, "a.b")).toBeUndefined();
  });
});

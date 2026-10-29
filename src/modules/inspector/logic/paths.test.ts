import { describe, expect, it } from "vitest";
import { pathPatch } from "./paths";

describe("pathPatch", () => {
  it("nests a value under its path", () => {
    expect(pathPatch("size", 4)).toEqual({ size: 4 });
    expect(pathPatch("outline.width", 4)).toEqual({ outline: { width: 4 } });
  });
});

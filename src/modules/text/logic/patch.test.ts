import { describe, expect, it } from "vitest";
import { mergePatch } from "./patch";

describe("mergePatch", () => {
  it("merges nested groups one level deep", () => {
    expect(
      mergePatch(
        { fill: { color: "#ffffff" }, size: 10 },
        { fill: { opacity: 0.5 }, italic: true },
      ),
    ).toEqual({ fill: { color: "#ffffff", opacity: 0.5 }, size: 10, italic: true });
  });
  it("lets the later value win", () => {
    expect(mergePatch({ size: 10 }, { size: 20 })).toEqual({ size: 20 });
  });
});

import { describe, expect, it } from "vitest";
import { IDENTITY_TRANSFORM } from "@/modules/project";
import { transformPatch } from "./commit";

const a = { ...IDENTITY_TRANSFORM };
const noRotation = new Set(["x", "y", "scale"]);

describe("transformPatch", () => {
  it("keeps only the changed, supported fields", () => {
    expect(transformPatch(a, { ...a, x: 9, rotation: 30 }, noRotation)).toEqual({ x: 9 });
  });
  it("is null when nothing changed", () => {
    expect(transformPatch(a, { ...a }, noRotation)).toBeNull();
  });
  it("is null when only an unsupported field changed", () => {
    expect(transformPatch(a, { ...a, rotation: 30 }, noRotation)).toBeNull();
  });
});

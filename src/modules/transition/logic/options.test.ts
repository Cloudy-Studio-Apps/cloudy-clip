import { describe, expect, it } from "vitest";
import { prop } from "@/modules/element";
import { optionFields, optionsPatch } from "./options";

describe("optionFields", () => {
  it("lists the visible options with a label and their default control", () => {
    const fields = optionFields(
      {
        direction: prop.enum(["left", "right", "up", "down"]),
        softness: prop.number({ control: "slider" }),
        seed: prop.number({ hidden: true }),
        tint: prop.color({ label: "Tint color" }),
      },
      () => undefined,
    );
    expect(fields.map((f) => [f.name, f.label, f.control])).toEqual([
      ["direction", "Direction", "segmented"],
      ["softness", "Softness", "slider"],
      ["tint", "Tint color", "color"],
    ]);
  });

  it("takes a custom option's control from its prop type", () => {
    const fields = optionFields({ thing: prop.custom("font", { sources: [] }) }, (name) =>
      name === "font" ? { name, control: "thing-control", schema: () => null! } : undefined,
    );
    expect(fields[0]?.control).toBe("thing-control");
  });
});

describe("optionsPatch", () => {
  it("merges stored options, pending input and the patch, later winning", () => {
    expect(optionsPatch({ a: 1, b: 2 }, { b: 3 }, { c: 4 })).toEqual({
      options: { a: 1, b: 3, c: 4 },
    });
  });
  it("does not change its inputs", () => {
    const stored = { a: 1 };
    optionsPatch(stored, { a: 2 });
    expect(stored).toEqual({ a: 1 });
  });
});

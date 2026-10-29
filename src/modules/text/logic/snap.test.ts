import { describe, expect, it } from "vitest";
import type { FontFamily } from "@/modules/fonts";
import { createEmptyProject } from "@/modules/project";
import { defaultTextStyle } from "./layout";
import { snapStyleToFamily } from "./snap";

const lobster: FontFamily = {
  family: "Lobster",
  source: "google",
  variants: [{ weight: "400", style: "normal" }],
};
const base = defaultTextStyle(createEmptyProject().format);
const style = (over: Partial<typeof base>) => ({
  ...base,
  font: { family: "Lobster", source: "google" as const },
  ...over,
});

describe("snapStyleToFamily", () => {
  it("snaps weight and italic to the faces the family has", () => {
    const out = snapStyleToFamily(style({ weight: "900", italic: true }), [lobster]);
    expect(out).toMatchObject({ weight: "400", italic: false });
  });

  it("keeps a face the family has", () => {
    const out = snapStyleToFamily(style({ weight: "400" }), [lobster]);
    expect(out).toEqual(style({ weight: "400" }));
  });

  it("leaves the style alone for an unknown family or an unloaded list", () => {
    const s = style({ weight: "900", italic: true });
    expect(snapStyleToFamily(s, [])).toBe(s);
    expect(snapStyleToFamily(s, undefined)).toBe(s);
  });
});

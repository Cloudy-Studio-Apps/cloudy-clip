import { describe, expect, it } from "vitest";
import { patchSchema, type TextMeasure } from "@/modules/element";
import type { Clip } from "@/modules/project";
import { defaultTextStyle } from "./logic/layout";
import { textElement } from "./text.element";

const format = { width: 1080, height: 1920, fps: 30 };
const measure: TextMeasure = (t, _f, ls) => t.length * 10 + Math.max(0, t.length - 1) * ls;
const clip: Clip = {
  id: "t",
  trackId: "v",
  kind: "text",
  props: {},
  start: 0,
  sourceIn: 0,
  duration: 1,
};
const PAD = 24.25;

describe("textElement", () => {
  it("resolves empty props to the default words and style", () => {
    expect(textElement.resolve(clip, format)).toEqual({
      text: "Text",
      ...defaultTextStyle(format),
    });
  });
  it("measures empty props like the old style-less clip", () => {
    const props = textElement.resolve(clip, format);
    expect(textElement.picture?.size?.(props, { format, measure })).toEqual({
      width: 40 + 2 * PAD,
      height: 97 * 1.25 + 2 * PAD,
    });
  });
  it("checks the ranges the old style schema had", () => {
    const schema = patchSchema(textElement.properties, { propType: () => undefined, groups: [] });
    expect(schema.safeParse({ outline: { width: 201 } }).success).toBe(false);
    expect(schema.safeParse({ outline: { width: 200 } }).success).toBe(true);
    expect(schema.safeParse({ size: 0 }).success).toBe(false);
    expect(schema.safeParse({ lineHeight: 4.5 }).success).toBe(false);
    expect(schema.safeParse({ weight: "950" }).success).toBe(false);
    expect(schema.safeParse({ text: " " }).success).toBe(false);
  });
  it("has no source file and sits on video tracks", () => {
    expect(textElement).toMatchObject({ kind: "text", source: "none", tracks: ["video"] });
    expect(textElement.picture?.fit).toBe("none");
  });
});

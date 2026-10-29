import { describe, expect, it } from "vitest";
import {
  cssFontFamily,
  defaultTextStyle,
  mergeTextStyle,
  textBox,
  textFont,
  textLayout,
} from "./project.text";
import type { TextClip, TextMeasure, TextStyle } from "./project.types";

const format = { width: 1080, height: 1920, fps: 30 };
const measure: TextMeasure = (t, _f, ls) => t.length * 10 + Math.max(0, t.length - 1) * ls;
const clip = (text: string, style?: TextStyle): TextClip => ({
  id: "t",
  trackId: "v",
  kind: "text",
  text,
  start: 0,
  sourceIn: 0,
  duration: 1,
  ...(style ? { style } : {}),
});
const base = defaultTextStyle(format);
const PAD = 24.25;
const LH = 97 * 1.25;

describe("defaultTextStyle", () => {
  it("is the old look", () => {
    expect(base.size).toBe(97);
    expect(base.font).toEqual({ family: "Inter", source: "bundled" });
    expect(base.weight).toBe("700");
    expect(base.shadow.enabled).toBe(true);
    expect(base.outline.enabled).toBe(false);
    expect(base.background.enabled).toBe(false);
  });
});

describe("textBox", () => {
  it("keeps the old size for a style-less clip", () => {
    expect(textBox(format, clip("Text"), measure)).toEqual({
      width: 40 + 2 * PAD,
      height: 97 * 1.25 + 2 * PAD,
    });
  });
});

describe("textLayout", () => {
  it("centers lines and keeps blank lines", () => {
    const l = textLayout("a\n\nccc", base, measure);
    expect(l.lines).toHaveLength(3);
    expect(l.lines[1]?.width).toBe(0);
    expect(l.box.height).toBeCloseTo(3 * LH + 2 * PAD);
    expect(l.lines.map((x) => x.x)).toEqual([-5, 0, -15]);
    expect(l.lines[0]?.y).toBeCloseTo(-l.box.height / 2 + PAD + LH / 2);
  });

  it("aligns left and right", () => {
    const left = textLayout("a\nccc", { ...base, align: "left" }, measure);
    const w = left.box.width;
    expect(left.lines.map((x) => x.x)).toEqual([-w / 2 + PAD, -w / 2 + PAD]);
    const right = textLayout("a\nccc", { ...base, align: "right" }, measure);
    expect(right.lines.map((x) => x.x)).toEqual([w / 2 - PAD - 10, w / 2 - PAD - 30]);
  });

  it("counts a trailing newline as a line", () => {
    expect(textLayout("ab\n", base, measure).lines).toHaveLength(2);
  });

  it("widens with letter spacing", () => {
    const a = textLayout("abc", base, measure).box.width;
    const b = textLayout("abc", { ...base, letterSpacing: 4 }, measure).box.width;
    expect(b - a).toBe(8);
  });

  it("uppercases only what is drawn", () => {
    const c = clip("abc");
    const l = textLayout(c.text, { ...base, uppercase: true }, measure);
    expect(l.lines[0]?.text).toBe("ABC");
    expect(c.text).toBe("abc");
  });

  it("grows the box for a wide outline", () => {
    const plain = textLayout("abc", base, measure).box;
    const out = textLayout(
      "abc",
      { ...base, outline: { ...base.outline, enabled: true, width: 80 } },
      measure,
    ).box;
    expect(out.width).toBe(30 + 80);
    expect(out.height).toBeGreaterThan(plain.height);
  });

  it("uses the background padding when enabled", () => {
    const style = { ...base, background: { ...base.background, enabled: true, padding: 50 } };
    expect(textLayout("abc", style, measure).box.width).toBe(30 + 100);
  });
});

describe("fonts", () => {
  it("quotes and escapes families", () => {
    expect(cssFontFamily({ family: 'O\'Font "X"', source: "google" })).toMatch(/^"O'Font \\"X\\""/);
    expect(cssFontFamily({ family: "Source Sans 3", source: "google" })).toMatch(
      /^"Source Sans 3"/,
    );
    expect(cssFontFamily({ family: "Inter", source: "bundled" })).toContain("Inter Variable");
  });

  it("builds the CSS font", () => {
    expect(textFont({ ...base, italic: true, weight: "400" }).startsWith("italic 400 97px ")).toBe(
      true,
    );
  });
});

describe("mergeTextStyle", () => {
  it("merges one level deep", () => {
    const next = mergeTextStyle(base, { fill: { opacity: 0.5 }, size: 50 });
    expect(next.fill).toEqual({ color: "#ffffff", opacity: 0.5 });
    expect(next.size).toBe(50);
    expect(base.fill.opacity).toBe(1);
  });
});

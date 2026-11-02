import { DEFAULT_GRADIENT } from "@/modules/element";
import { cssFontFamily } from "@/modules/fonts";
import type { Clip, PictureSize, ProjectFormat } from "@/modules/project";
import type { TextMeasure } from "@/modules/element";
import type { TextLayout, TextLine, TextStyle, TextStylePatch } from "../text.types";

/** Words of a new text clip. */
export const DEFAULT_TEXT = "Text";

/** Whether a clip is a text clip. */
export function isTextClip(clip: Clip): boolean {
  return clip.kind === "text";
}

/** The words of a text clip (`props.text`, or the default words). */
export function clipText(clip: Clip): string {
  const text = clip.props.text;
  return typeof text === "string" ? text : DEFAULT_TEXT;
}

/** The look of a text with no style of its own: bold white Inter with a soft shadow, 9% of the short side. */
export function defaultTextStyle(format: ProjectFormat): TextStyle {
  const size = Math.round(Math.min(format.width, format.height) * 0.09);
  return {
    font: { family: "Inter", source: "bundled" },
    size,
    weight: "700",
    italic: false,
    letterSpacing: 0,
    lineHeight: 1.25,
    align: "center",
    uppercase: false,
    fill: { type: "color", color: "#ffffff", opacity: 1, gradient: { ...DEFAULT_GRADIENT } },
    outline: { enabled: false, color: "#000000", width: size * 0.08 },
    background: {
      enabled: false,
      color: "#000000",
      opacity: 0.6,
      padding: size * 0.25,
      radius: size * 0.15,
    },
    shadow: {
      enabled: true,
      color: "#000000",
      opacity: 0.6,
      blur: size * 0.08,
      distance: size * 0.03,
      angle: 90,
    },
  };
}

/** The style a text clip is drawn with: its stored values over the default style. */
export function textStyleOf(clip: Clip, format: ProjectFormat): TextStyle {
  const style: Record<string, unknown> = { ...clip.props };
  delete style.text;
  return mergeTextStyle(defaultTextStyle(format), style as TextStylePatch);
}

function definedOnly(group: object): object {
  return Object.fromEntries(Object.entries(group).filter(([, v]) => v !== undefined));
}

/** `style` with `patch` applied; nested groups (fill, outline, …) merge one level deep. */
export function mergeTextStyle(style: TextStyle, patch: TextStylePatch): TextStyle {
  const next: Record<string, unknown> = { ...style };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    const current = (style as unknown as Record<string, unknown>)[key];
    next[key] =
      typeof value === "object" && value !== null && typeof current === "object"
        ? { ...(current as object), ...definedOnly(value as object) }
        : value;
  }
  return next as unknown as TextStyle;
}

/** CSS font of a style, in output pixels. */
export function textFont(style: TextStyle): string {
  return `${style.italic ? "italic " : ""}${style.weight} ${style.size}px ${cssFontFamily(style.font)}`;
}

/** The words as drawn (uppercase applied); `clip.text` itself is never changed. */
export function displayText(text: string, style: TextStyle): string {
  return style.uppercase ? text.toUpperCase() : text;
}

/** Space between the words and the edge of the box: background padding or outline reach, whichever is larger. */
export function textPadding(style: TextStyle): number {
  const base = style.background.enabled ? style.background.padding : style.size * 0.25;
  return Math.max(base, style.outline.enabled ? style.outline.width / 2 : 0);
}

/**
 * Lays out a text: one entry per line (an empty line has width 0 but takes a full line), the box
 * around them and each line's position from the box center.
 */
export function textLayout(text: string, style: TextStyle, measure: TextMeasure): TextLayout {
  const font = textFont(style);
  const pad = textPadding(style);
  const lineHeight = style.size * style.lineHeight;
  const parts = displayText(text, style).split("\n");
  const widths = parts.map((part) => (part === "" ? 0 : measure(part, font, style.letterSpacing)));
  const box: PictureSize = {
    width: Math.max(1, Math.max(...widths) + pad * 2),
    height: parts.length * lineHeight + pad * 2,
  };
  const lines: TextLine[] = parts.map((part, i) => {
    const width = widths[i] ?? 0;
    const x =
      style.align === "left"
        ? -box.width / 2 + pad
        : style.align === "right"
          ? box.width / 2 - pad - width
          : 0 - width / 2;
    return { text: part, x, y: -box.height / 2 + pad + lineHeight * (i + 0.5), width };
  });
  return { box, lines, font, lineHeight };
}

/**
 * Natural size of a text's box in output pixels (words plus padding). The engine draws it and
 * the canvas tools hit-test it with the same box, through `clipPlacement(…, "none")`.
 */
export function textBox(format: ProjectFormat, clip: Clip, measure: TextMeasure): PictureSize {
  return textLayout(clipText(clip), textStyleOf(clip, format), measure).box;
}

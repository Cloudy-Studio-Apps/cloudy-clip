import type {
  Clip,
  PictureSize,
  ProjectFormat,
  TextClip,
  TextFontRef,
  TextLayout,
  TextLine,
  TextMeasure,
  TextMeasureContext,
  TextStyle,
  TextStylePatch,
} from "./project.types";

/** Words of a new text clip. */
export const DEFAULT_TEXT = "Text";

/** Fontsource family names of the fonts shipped with the app. */
const BUNDLED_FAMILIES: Record<string, string> = {
  Inter: "Inter Variable",
  "JetBrains Mono": "JetBrains Mono Variable",
};

/** The CSS family name a font is registered under ("Inter" is "Inter Variable"; other sources keep their name). */
export function bundledCssFamily(family: string): string {
  return BUNDLED_FAMILIES[family] ?? family;
}

/**
 * A `TextMeasure` over a 2D canvas context, so the engine and the canvas tools measure alike.
 * Widths follow the contract `(n-1)·letterSpacing` between letters: the canvas also adds spacing
 * after the last letter, which is taken off. Without `ctx.letterSpacing` the letters are measured
 * one by one.
 */
export function canvasTextMeasure(ctx: TextMeasureContext | null): TextMeasure {
  return (text, font, letterSpacing) => {
    if (!ctx || text === "") return 0;
    ctx.font = font;
    if ("letterSpacing" in ctx) {
      ctx.letterSpacing = `${letterSpacing}px`;
      const width = ctx.measureText(text).width;
      return letterSpacing !== 0 ? width - letterSpacing : width;
    }
    const letters = [...text];
    const sum = letters.reduce((total, letter) => total + ctx.measureText(letter).width, 0);
    return sum + letterSpacing * (letters.length - 1);
  };
}

/** Whether a clip is a text clip. */
export function isTextClip(clip: Clip): clip is TextClip {
  return clip.kind === "text";
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
    fill: { color: "#ffffff", opacity: 1 },
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

/** The style a clip is drawn with: its own, or the default. */
export function textStyleOf(clip: TextClip, format: ProjectFormat): TextStyle {
  return clip.style ?? defaultTextStyle(format);
}

/** `style` with `patch` applied; nested groups (fill, outline, …) merge one level deep. */
export function mergeTextStyle(style: TextStyle, patch: TextStylePatch): TextStyle {
  const next: Record<string, unknown> = { ...style };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    const current = (style as unknown as Record<string, unknown>)[key];
    next[key] =
      typeof value === "object" && value !== null && typeof current === "object"
        ? { ...(current as object), ...value }
        : value;
  }
  return next as unknown as TextStyle;
}

/** CSS `font-family` list for a font: its quoted, escaped name, then Inter and a generic fallback. */
export function cssFontFamily(font: TextFontRef): string {
  const name = font.source === "bundled" ? bundledCssFamily(font.family) : font.family;
  const quoted = `"${name.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  return name === "Inter Variable"
    ? `${quoted}, sans-serif`
    : `${quoted}, "Inter Variable", sans-serif`;
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
export function textBox(format: ProjectFormat, clip: TextClip, measure: TextMeasure): PictureSize {
  return textLayout(clip.text, textStyleOf(clip, format), measure).box;
}

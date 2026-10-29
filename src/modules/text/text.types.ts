import type { FontRef, FontWeight } from "@/modules/fonts";
import type { PictureSize } from "@/modules/project";

/** The text module's API. Empty: its element, commands and controls are its whole surface. */
export type TextApi = Record<string, never>;

/** Ready-made looks for a text: `title`, `highlight`, `outline`, `pop` and `lower-third`. */
export type TextPresetId = "title" | "highlight" | "outline" | "pop" | "lower-third";

/** Horizontal alignment of the lines inside the text's box. */
export type TextAlign = "left" | "center" | "right";

/** Color of the letters (`#rrggbb`) and its opacity (0-1). */
export type TextFill = {
  color: string;
  opacity: number;
};

/** Stroke around the letters; `width` in output pixels. */
export type TextOutline = {
  enabled: boolean;
  color: string;
  width: number;
};

/** Box behind the text; `padding` and `radius` in output pixels. */
export type TextBackground = {
  enabled: boolean;
  color: string;
  opacity: number;
  padding: number;
  radius: number;
};

/** Shadow of the letters; `blur` and `distance` in output pixels, `angle` in degrees (90 = down). */
export type TextShadow = {
  enabled: boolean;
  color: string;
  opacity: number;
  blur: number;
  distance: number;
  angle: number;
};

/** Everything that decides how a text looks. Sizes are output pixels. */
export type TextStyle = {
  font: FontRef;
  /** Font size in output pixels. */
  size: number;
  weight: FontWeight;
  italic: boolean;
  /** Extra space between letters, in output pixels. */
  letterSpacing: number;
  /** Line height in font sizes. */
  lineHeight: number;
  align: TextAlign;
  uppercase: boolean;
  fill: TextFill;
  outline: TextOutline;
  background: TextBackground;
  shadow: TextShadow;
};

/** A partial style: top-level fields, and nested groups may be partial too (one level deep). */
export type TextStylePatch = {
  [K in keyof TextStyle]?: TextStyle[K] extends object ? Partial<TextStyle[K]> : TextStyle[K];
};

/** One laid-out line. `x` is its left edge and `y` its middle, both from the box center. */
export type TextLine = {
  text: string;
  x: number;
  y: number;
  width: number;
};

/** A text laid out: its box, its lines, and the CSS font and line height used. */
export type TextLayout = {
  box: PictureSize;
  lines: TextLine[];
  font: string;
  lineHeight: number;
};

/** A text clip's values: its words and style. */
export type TextProps = { text: string } & TextStyle;

/** A font family and where to get it. */
export type TextFontRef = FontRef;

declare module "@/core" {
  interface CommandInputs {
    "text.applyPreset": { clipIds: string[]; preset: TextPresetId };
  }
}

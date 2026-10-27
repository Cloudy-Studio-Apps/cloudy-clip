import type { Clip, PictureSize, ProjectFormat, TextClip, TextMeasure } from "./project.types";

/** Words of a new text clip (editing them comes later). */
export const DEFAULT_TEXT = "Text";

/** The one text style for now: bold Inter, white with a dark shadow so it reads on any video. */
export const TEXT_STYLE = {
  family: '"Inter Variable", sans-serif',
  weight: 700,
  color: "#ffffff",
  shadow: "rgba(0, 0, 0, 0.6)",
  /** Line height and padding around the words, in font sizes. */
  lineHeight: 1.25,
  padding: 0.25,
} as const;

/** Whether a clip is a text clip. */
export function isTextClip(clip: Clip): clip is TextClip {
  return clip.kind === "text";
}

/** Font size of text in output pixels: 9% of the frame's short side. */
export function textFontSize(format: ProjectFormat): number {
  return Math.round(Math.min(format.width, format.height) * 0.09);
}

/** CSS font of text in output pixels. */
export function textFont(format: ProjectFormat): string {
  return `${TEXT_STYLE.weight} ${textFontSize(format)}px ${TEXT_STYLE.family}`;
}

/**
 * Natural size of a text's box in output pixels (words plus padding). The engine draws it and
 * the canvas tools hit-test it with the same box, through `clipPlacement(…, "none")`.
 */
export function textBox(format: ProjectFormat, text: string, measure: TextMeasure): PictureSize {
  const size = textFontSize(format);
  const pad = size * TEXT_STYLE.padding;
  return {
    width: Math.max(1, measure(text, textFont(format)) + pad * 2),
    height: size * TEXT_STYLE.lineHeight + pad * 2,
  };
}

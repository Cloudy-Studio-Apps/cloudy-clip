import { elementRef, parsePatch, type NormalizeEnv } from "@/modules/element";
import { fontsRef } from "@/modules/fonts";
import type { Clip } from "@/modules/project";
import { snapStyleToFamily } from "./logic/snap";
import { textElement } from "./text.element";
import type { TextStyle } from "./text.types";

/** Whether a clip is a text clip. The one place outside the text element that checks the kind. */
export function isTextClip(clip: Clip): boolean {
  return clip.kind === textElement.kind;
}

/**
 * The style as a text clip would store it: faces snapped to the family, colors as the patch schema
 * writes them. Like the element's `normalize`, without the explicit-face check; fails
 * `element.invalid_props` when a value is out of range.
 */
export function normalizeTextStyle(
  style: Record<string, unknown>,
  env: NormalizeEnv,
): Record<string, unknown> {
  const element = env.require(elementRef).get(textElement.kind);
  if (!element) return style;
  const families = env.require(fontsRef).knownFamilies();
  const snapped = style.font ? snapStyleToFamily(style as TextStyle, families) : style;
  return parsePatch(element, { ...style, ...snapped });
}

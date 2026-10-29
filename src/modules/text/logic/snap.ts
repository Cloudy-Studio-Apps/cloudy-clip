import { closestVariant, type FontFamily } from "@/modules/fonts";
import type { TextStyle } from "../text.types";

/**
 * The style with its weight and italic moved to the closest face its font family has. Unchanged
 * (same object) when the family isn't in `families` or the list isn't loaded yet.
 */
export function snapStyleToFamily(
  style: TextStyle,
  families: readonly FontFamily[] | undefined,
): TextStyle {
  const family = families?.find((f) => f.family === style.font.family);
  if (!family || family.variants.length === 0) return style;
  const face = closestVariant(family, {
    weight: style.weight,
    style: style.italic ? "italic" : "normal",
  });
  const italic = face.style === "italic";
  if (face.weight === style.weight && italic === style.italic) return style;
  return { ...style, weight: face.weight, italic };
}

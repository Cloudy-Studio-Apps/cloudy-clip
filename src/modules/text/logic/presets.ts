import type { ClipTransform, ProjectFormat } from "@/modules/project";
import type { TextStylePatch } from "../text.types";
import type { TextPresetId } from "../text.types";

/** The style fields a preset sets, in output pixels for `format` (fractions of its short side). */
export function presetStyle(id: TextPresetId, format: ProjectFormat): TextStylePatch {
  const s = Math.min(format.width, format.height);
  const px = (fraction: number) => Math.round(fraction * s);
  switch (id) {
    case "title":
      return {
        size: px(0.09),
        weight: "900",
        fill: { type: "color", color: "#ffffff", opacity: 1 },
        outline: { enabled: false },
        background: { enabled: false },
        shadow: { enabled: true },
      };
    case "highlight":
      return {
        size: px(0.06),
        weight: "600",
        fill: { type: "color", color: "#1f2430", opacity: 1 },
        background: {
          enabled: true,
          color: "#f2a385",
          opacity: 1,
          padding: px(0.02),
          radius: px(0.006),
        },
      };
    case "outline":
      return {
        size: px(0.067),
        weight: "900",
        fill: { type: "color", color: "#ffffff", opacity: 1 },
        outline: { enabled: true, color: "#000000", width: px(0.008) },
        shadow: { enabled: false },
      };
    case "pop":
      return {
        size: px(0.074),
        weight: "700",
        italic: true,
        fill: { type: "color", color: "#8cc4f0", opacity: 1 },
        shadow: { enabled: true },
      };
    case "lower-third":
      return {
        size: px(0.04),
        weight: "700",
        align: "left",
        background: { enabled: true, color: "#1f2430", opacity: 0.8, padding: px(0.015) },
      };
  }
}

/** Where a preset puts the text in the frame, or null when it leaves the position alone. */
export function presetTransform(id: TextPresetId, format: ProjectFormat): ClipTransform | null {
  if (id !== "lower-third") return null;
  return { x: -0.2 * format.width, y: 0.32 * format.height, scale: 1, rotation: 0 };
}

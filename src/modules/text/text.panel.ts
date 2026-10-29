import type { LayoutSection } from "@/modules/element";

/**
 * The text clip's panel: words and presets, font (with a Spacing sub-section), then fill, outline,
 * background and shadow, each group's switch in its header.
 */
export const textPanelLayout: LayoutSection[] = [
  {
    title: "Content",
    items: ["text", { command: "text.applyPreset", control: "preset-row", label: "Presets" }],
  },
  {
    title: "Font",
    items: [
      "font",
      { row: ["weight", "italic", "uppercase"] },
      "size",
      "align",
      { title: "Spacing", items: ["letterSpacing", "lineHeight"] },
    ],
  },
  { items: ["fill"] },
  { items: ["outline"] },
  { title: "Background", items: ["background"] },
  { items: ["shadow"] },
];

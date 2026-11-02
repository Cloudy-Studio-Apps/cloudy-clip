import type { LayoutSection } from "@/modules/element";

/**
 * The text clip's panel, in its Text tab: words and presets, font (with a Spacing sub-section), then fill, outline,
 * background and shadow, each group's switch in its header.
 */
export const textPanelLayout: LayoutSection[] = [
  {
    title: "Content",
    tab: "text",
    items: ["text", { command: "text.applyPreset", control: "preset-row", label: "Presets" }],
  },
  {
    title: "Font",
    tab: "text",
    items: [
      "font",
      { row: ["weight", "italic", "uppercase"], label: "Style" },
      "size",
      "align",
      { title: "Spacing", items: ["letterSpacing", "lineHeight"] },
    ],
  },
  { tab: "text", items: ["fill"] },
  { tab: "text", items: ["outline"] },
  { title: "Background", tab: "text", items: ["background"] },
  { tab: "text", items: ["shadow"] },
];

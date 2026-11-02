import { defineSharedGroup, prop } from "@/modules/element";
import { BLEND_MODES, IDENTITY_COMPOSITE } from "@/modules/project";

/**
 * How a picture lands on what's under it: a blend mode and an opacity. Stored at `clip.composite`;
 * missing means Normal at 100%. Only for clips on video tracks.
 */
export const compositeGroup = defineSharedGroup({
  id: "composite",
  key: "composite",
  label: "Composite",
  order: 910,
  properties: {
    mode: prop.enum(BLEND_MODES, {
      labels: {
        normal: "Normal",
        add: "Add",
        multiply: "Multiply",
        screen: "Screen",
        overlay: "Overlay",
        softLight: "Soft Light",
        hardLight: "Hard Light",
        darken: "Darken",
        lighten: "Lighten",
        colorDodge: "Color Dodge",
        colorBurn: "Color Burn",
        difference: "Difference",
        exclusion: "Exclusion",
        hue: "Hue",
        saturation: "Saturation",
        color: "Color",
        luminosity: "Luminosity",
      },
    }),
    opacity: prop.number({
      min: 0,
      max: 1,
      step: 0.01,
      control: "slider",
      display: { scale: 100, unit: "%" },
    }),
  },
  defaults: () => ({ ...IDENTITY_COMPOSITE }),
  appliesTo: (_clip, track) => track.kind === "video",
  layout: {
    title: "Composite",
    order: 910,
    tab: "video",
    items: ["mode", "opacity"],
  },
});

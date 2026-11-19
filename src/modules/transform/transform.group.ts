import { defineSharedGroup, prop } from "@/modules/element";
import { IDENTITY_TRANSFORM, normalizeRotation } from "@/modules/project";

const pixels = { min: -100_000, max: 100_000, unit: "px" } as const;
const stretch = {
  min: -20,
  max: 20,
  control: "slider",
  ui: { min: -4, max: 4, step: 0.01 },
  display: { scale: 100, unit: "%" },
} as const;
const pivot = { min: -10, max: 10, display: { scale: 100, unit: "%" } } as const;

/**
 * Where a picture sits in the frame, the After Effects way: its pivot sits at `x`, `y` from the
 * frame's center (output px, y down); scale (1 = fitted), stretch (`scaleX`, `scaleY`, negative
 * flips) and clockwise rotation happen about the pivot (`pivotX`, `pivotY`, fractions of the
 * picture from its center). Stored at `clip.transform`; missing means fitted and centered. Only for
 * clips on video tracks.
 */
export const transformGroup = defineSharedGroup({
  id: "transform",
  key: "transform",
  label: "Transform",
  order: 900,
  properties: {
    x: prop.number({ ...pixels, label: "X" }),
    y: prop.number({ ...pixels, label: "Y" }),
    scale: prop.number({
      min: 0.01,
      max: 20,
      control: "slider",
      ui: { min: 0.01, max: 4, step: 0.01 },
      display: { scale: 100, unit: "%" },
    }),
    scaleX: prop.number({ ...stretch, label: "Width" }),
    scaleY: prop.number({ ...stretch, label: "Height" }),
    rotation: prop.number({
      min: -3600,
      max: 3600,
      unit: "°",
      control: "slider",
      ui: { min: -180, max: 180, step: 1 },
    }),
    pivotX: prop.number({ ...pivot, label: "X" }),
    pivotY: prop.number({ ...pivot, label: "Y" }),
  },
  defaults: () => ({ ...IDENTITY_TRANSFORM }),
  normalize: (value) => ({ ...value, rotation: normalizeRotation(Number(value.rotation)) }),
  appliesTo: (_clip, track) => track.kind === "video",
  layout: {
    title: "Transform",
    order: 900,
    tab: "video",
    items: [
      { row: ["x", "y"], label: "Position" },
      "scale",
      { row: ["scaleX", "scaleY"], label: "Stretch" },
      "rotation",
      { row: ["pivotX", "pivotY"], label: "Pivot" },
      { command: "transform.flip", control: "choices", label: "Flip" },
    ],
  },
});

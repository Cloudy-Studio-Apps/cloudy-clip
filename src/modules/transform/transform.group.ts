import { defineSharedGroup, prop } from "@/modules/element";
import { IDENTITY_TRANSFORM, normalizeRotation } from "@/modules/project";

const pixels = { min: -100_000, max: 100_000, unit: "px" } as const;

/**
 * Where a picture sits in the frame: offset of its center from the frame's center (output px, y
 * down), scale (1 = fitted) and clockwise rotation. Stored at `clip.transform`; missing means
 * fitted and centered. Only for clips on video tracks.
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
    rotation: prop.number({
      min: -3600,
      max: 3600,
      unit: "°",
      control: "slider",
      ui: { min: -180, max: 180, step: 1 },
    }),
  },
  defaults: () => ({ ...IDENTITY_TRANSFORM }),
  normalize: (value) => ({ ...value, rotation: normalizeRotation(Number(value.rotation)) }),
  appliesTo: (_clip, track) => track.kind === "video",
  layout: {
    title: "Transform",
    order: 900,
    tab: "video",
    items: [{ row: ["x", "y"], label: "Position" }, "scale", "rotation"],
  },
});

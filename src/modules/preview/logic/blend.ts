import type { BlendMode } from "@/modules/project";

const NAMED: Partial<Record<BlendMode, GlobalCompositeOperation>> = {
  normal: "source-over",
  add: "lighter",
  softLight: "soft-light",
  hardLight: "hard-light",
  colorDodge: "color-dodge",
  colorBurn: "color-burn",
};

/** The canvas operation of a blend mode. The rest are named the same on both sides. */
export function canvasBlend(mode: BlendMode): GlobalCompositeOperation {
  return NAMED[mode] ?? (mode as GlobalCompositeOperation);
}

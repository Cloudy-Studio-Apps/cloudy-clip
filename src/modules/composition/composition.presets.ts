import type { ProjectFormat } from "@/modules/project";
import type { CompositionPreset } from "./composition.types";

/** Formats offered in the dialog. */
export const COMPOSITION_PRESETS: readonly CompositionPreset[] = [
  { id: "9:16", label: "9:16", hint: "Reels, TikTok, Shorts", format: size(1080, 1920) },
  { id: "16:9", label: "16:9", hint: "YouTube, landscape", format: size(1920, 1080) },
  { id: "1:1", label: "1:1", hint: "Square", format: size(1080, 1080) },
  { id: "4:5", label: "4:5", hint: "Instagram feed", format: size(1080, 1350) },
  { id: "4k-16:9", label: "4K 16:9", hint: "Landscape, UHD", format: size(3840, 2160) },
  { id: "4k-9:16", label: "4K 9:16", hint: "Vertical, UHD", format: size(2160, 3840) },
];

/** Frame rates offered in the dialog. */
export const FPS_OPTIONS: readonly { label: string; fps: number }[] = [
  { label: "23.976", fps: 24_000 / 1001 },
  { label: "24", fps: 24 },
  { label: "25", fps: 25 },
  { label: "29.97", fps: 30_000 / 1001 },
  { label: "30", fps: 30 },
  { label: "50", fps: 50 },
  { label: "59.94", fps: 60_000 / 1001 },
  { label: "60", fps: 60 },
];

function size(width: number, height: number): ProjectFormat {
  return { width, height, fps: 30 };
}

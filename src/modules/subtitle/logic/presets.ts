import { mergeProps } from "@/modules/element";
import type { ProjectFormat } from "@/modules/project";
import { defaultTextStyle } from "@/modules/text";
import type { SubtitlePreset, SubtitlePresetId } from "../subtitle.types";

/** The name a preset's style gets. */
export const PRESET_NAMES: Record<SubtitlePresetId, string> = {
  classic: "Classic",
  punchy: "Punchy",
  intense: "Intense",
  whisper: "Whisper",
};

/** A preset's text props (whole, over the default text style) and position, in `format`'s pixels. */
export function subtitlePreset(id: SubtitlePresetId, format: ProjectFormat): SubtitlePreset {
  const s = Math.min(format.width, format.height);
  const px = (fraction: number) => Math.round(fraction * s);
  const punchy = {
    font: { family: "Inter", source: "bundled" },
    size: px(0.08),
    weight: "900",
    uppercase: true,
    outline: { enabled: true, color: "#000000", width: px(0.008) },
    shadow: { enabled: false },
  };
  const presets: Record<SubtitlePresetId, [Record<string, unknown>, number]> = {
    classic: [
      {
        // Small enough for two lines of a sentence across the frame.
        size: px(0.055),
        weight: "700",
        fill: { type: "color", color: "#ffffff", opacity: 1 },
        shadow: { enabled: true },
        background: { enabled: false },
      },
      0.32,
    ],
    punchy: [punchy, 0],
    intense: [{ ...punchy, fill: { type: "color", color: "#ffd54a", opacity: 1 } }, 0.16],
    whisper: [
      {
        size: px(0.045),
        italic: true,
        background: { enabled: true, color: "#1b2a36", opacity: 0.8, padding: px(0.012) },
        shadow: { enabled: false },
      },
      0.34,
    ],
  };
  const [patch, y] = presets[id];
  const base = defaultTextStyle(format) as unknown as Record<string, unknown>;
  return { props: mergeProps(base, patch), position: { x: 0, y: y * format.height } };
}

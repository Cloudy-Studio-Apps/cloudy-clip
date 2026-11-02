import { microsToSeconds, type Micros } from "@/core";
import type { ProjectFormat } from "@/modules/project";
import type { ExportEffort, ExportFormatInfo } from "../export.types";

/** Pixels of a 1080p frame. */
const FULL_HD = 2_073_600;
/** Measured in the app: about 13 frames a second drawn and read back. */
const DRAW_SECONDS_PER_FRAME = 0.08;

const EFFORT_SIZE: Record<ExportEffort, number> = { fast: 1.15, balanced: 1, small: 0.85 };
const EFFORT_TIME: Record<ExportEffort, number> = { fast: 0.5, balanced: 1, small: 2.2 };

/** What an export needs for its estimates. */
interface EstimateInput {
  format: ProjectFormat;
  info: ExportFormatInfo;
  quality: number;
  duration: Micros;
  sound: boolean;
  effort: ExportEffort;
  hardware: boolean;
}

/** Roughly how many bytes the file takes. */
export function estimateBytes(input: EstimateInput): number {
  const { format, info, quality, duration, sound, effort } = input;
  const seconds = microsToSeconds(duration);
  const pixels = (format.width * format.height) / FULL_HD;
  const megabits = pixels * (format.fps / 30) * 1.5 * 2 ** ((quality - 30) / 14);
  const picture = (megabits * info.sizeFactor * seconds * EFFORT_SIZE[effort] * 1_000_000) / 8;
  const audio = info.sound && sound ? (240_000 * seconds) / 8 : 0;
  return Math.round(picture + audio);
}

/** Roughly how many seconds the export takes. */
export function estimateSeconds(input: EstimateInput): number {
  const { format, info, duration, effort, hardware } = input;
  const seconds = microsToSeconds(duration);
  if (!info.picture) return Math.max(1, seconds * info.timeFactor);
  const frames = seconds * format.fps;
  const pixels = (format.width * format.height) / FULL_HD;
  const encode = 0.02 * pixels * info.timeFactor * EFFORT_TIME[effort] * (hardware ? 0.3 : 1);
  return Math.max(1, frames * (DRAW_SECONDS_PER_FRAME * Math.max(1, pixels / 2) + encode));
}

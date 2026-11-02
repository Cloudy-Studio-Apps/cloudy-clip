import type { DensityMetrics, ThemeDensity } from "../theme.types";

/** Sizes per density, in px. `default` is the app's own look, as `tokens.css` has it. */
export const DENSITY_METRICS: Readonly<Record<ThemeDensity, DensityMetrics>> = {
  compact: {
    controlHeightSm: 24,
    controlHeight: 26,
    controlHeightLg: 30,
    rowHeight: 22,
    controlPadding: 8,
    trackHeightVideo: 52,
    trackHeightAudio: 36,
  },
  default: {
    controlHeightSm: 28,
    controlHeight: 30,
    controlHeightLg: 34,
    rowHeight: 26,
    controlPadding: 12,
    trackHeightVideo: 64,
    trackHeightAudio: 44,
  },
  comfortable: {
    controlHeightSm: 32,
    controlHeight: 34,
    controlHeightLg: 38,
    rowHeight: 30,
    controlPadding: 14,
    trackHeightVideo: 76,
    trackHeightAudio: 52,
  },
};

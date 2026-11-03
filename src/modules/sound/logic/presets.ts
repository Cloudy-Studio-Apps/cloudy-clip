import { DEFAULT_SOUND, type EqBand } from "@/modules/project";
import type { EffectSpec, SoundPreset } from "../sound.types";

/** The six bands of a clip's EQ with some replaced (by position: lowCut, lowShelf, then four more). */
function bands(changes: Partial<Record<number, Partial<EqBand>>>): EqBand[] {
  return DEFAULT_SOUND.eq.bands.map((band, i) => ({ ...band, ...changes[i] }));
}

const eq = (changes: Partial<Record<number, Partial<EqBand>>>): EffectSpec => ({
  kind: "eq",
  on: true,
  bands: bands(changes),
});

/** The presets that come with the app: plain chains of effects, in signal order. */
export const BUILT_IN_PRESETS: readonly SoundPreset[] = [
  {
    id: "clear-voice",
    name: "Clear voice",
    description: "A spoken voice that cuts through: rumble and mud out, presence in, level evened.",
    effects: [
      eq({ 0: { hz: 80 }, 2: { hz: 300, db: -3 }, 4: { hz: 3500, db: 2.5 } }),
      { kind: "gate", on: true, thresholdDb: -50, ratio: 2, attackMs: 5, releaseMs: 150 },
      {
        kind: "compressor",
        on: true,
        params: {
          thresholdDb: -18,
          ratio: 3,
          attackMs: 10,
          releaseMs: 120,
          kneeDb: 6,
          makeupDb: 3,
        },
      },
      { kind: "deesser", on: true, frequencyHz: 6500, amount: 0.4 },
    ],
  },
  {
    id: "podcast",
    name: "Podcast",
    description: "Steady, close and safe to publish: tighter dynamics and a limiter at the end.",
    effects: [
      eq({ 0: { hz: 70 }, 2: { hz: 200, db: -2 }, 4: { hz: 4000, db: 2 } }),
      { kind: "gate", on: true, thresholdDb: -45, ratio: 3, attackMs: 5, releaseMs: 200 },
      {
        kind: "compressor",
        on: true,
        params: { thresholdDb: -20, ratio: 4, attackMs: 5, releaseMs: 150, kneeDb: 4, makeupDb: 5 },
      },
      { kind: "deesser", on: true, frequencyHz: 7000, amount: 0.5 },
      { kind: "limiter", on: true, ceilingDb: -1, releaseMs: 100 },
    ],
  },
  {
    id: "phone",
    name: "Phone",
    description: "A voice down a telephone line: narrow band, pushed forward.",
    effects: [
      eq({ 0: { hz: 400 }, 3: { hz: 1500, db: 4, q: 1.5 }, 5: { hz: 3400 } }),
      {
        kind: "compressor",
        on: true,
        params: { thresholdDb: -24, ratio: 6, attackMs: 5, releaseMs: 80, kneeDb: 2, makeupDb: 6 },
      },
      { kind: "limiter", on: true, ceilingDb: -3, releaseMs: 50 },
    ],
  },
  {
    id: "radio",
    name: "Radio",
    description: "A broadcast voice: a little proximity, bright and loud.",
    effects: [
      eq({ 0: { hz: 100 }, 2: { hz: 250, db: 2 }, 4: { hz: 3000, db: 3 }, 5: { hz: 12000 } }),
      {
        kind: "compressor",
        on: true,
        params: { thresholdDb: -22, ratio: 5, attackMs: 3, releaseMs: 60, kneeDb: 3, makeupDb: 8 },
      },
      { kind: "limiter", on: true, ceilingDb: -0.5, releaseMs: 50 },
    ],
  },
  {
    id: "warm",
    name: "Warm",
    description: "Rounder and softer: more body, less edge, gently compressed.",
    effects: [
      eq({ 1: { hz: 200, db: 2.5 }, 4: { hz: 3500, db: -2, q: 0.8 }, 5: { hz: 10000 } }),
      {
        kind: "compressor",
        on: true,
        params: {
          thresholdDb: -16,
          ratio: 2,
          attackMs: 15,
          releaseMs: 200,
          kneeDb: 9,
          makeupDb: 2,
        },
      },
    ],
  },
];

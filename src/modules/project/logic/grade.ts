import type { ProjectState } from "../project.types";
import {
  MIX_FAMILIES,
  ZONE_NAMES,
  type Clip,
  type ClipGrade,
  type Correction,
  type CorrectionValues,
  type CurvePoints,
  type Wheel,
  type ZoneWheel,
} from "../project.types";

/** What a built-in look's id starts with; any other `lut` id names an imported one in `ProjectState.luts`. */
export const BUILTIN_LUT_PREFIX = "builtin:";

const wheel = (): Wheel => ({ x: 0, y: 0, m: 0 });
const identity = (): CurvePoints => [
  [0, 0],
  [1, 1],
];
const flat = (): CurvePoints => [
  [0, 0.5],
  [1, 0.5],
];
const ZONE_AT = [0.06, 0.2, 0.38, 0.62, 0.82, 0.96] as const;

/** A correction that does nothing: every value as the picture is. Values equal to it are never stored. */
export const DEFAULT_CORRECTION: CorrectionValues = {
  exposure: 0,
  contrast: 1,
  pivot: 0.435,
  highlights: 0,
  shadows: 0,
  whites: 0,
  blacks: 0,
  temperature: 0,
  tint: 0,
  vibrance: 0,
  saturation: 1,
  hue: 0,
  rolloff: 0,
  protectSkin: false,
  lift: wheel(),
  gamma: wheel(),
  gain: wheel(),
  offset: wheel(),
  log: {
    shadow: wheel(),
    midtone: wheel(),
    highlight: wheel(),
    lowRange: 0.333,
    highRange: 0.55,
  },
  zones: Object.fromEntries(
    ZONE_NAMES.map((name, i): [string, ZoneWheel] => [name, { ...wheel(), at: ZONE_AT[i]! }]),
  ) as CorrectionValues["zones"],
  curves: {
    rgb: { y: identity(), r: identity(), g: identity(), b: identity() },
    hueHue: flat(),
    hueSat: flat(),
    hueLum: flat(),
    lumSat: flat(),
  },
  mix: {
    ...(Object.fromEntries(
      MIX_FAMILIES.map((name) => [name, { hue: 0, sat: 0, lum: 0 }]),
    ) as Record<(typeof MIX_FAMILIES)[number], { hue: number; sat: number; lum: number }>),
    range: 0,
  },
  warper: { points: {}, smoothing: 50, pinned: [] },
  creative: {
    shadowTint: { x: 0, y: 0 },
    highlightTint: { x: 0, y: 0 },
    balance: 0,
    fade: 0,
    vignette: { amount: 0, midpoint: 50, roundness: 0, feather: 50 },
  },
  mixer: {
    matrix: [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ],
    keepBrightness: true,
    mono: false,
  },
  skinPull: 0,
};

const range = (min: number, max: number) => ({ min, max });

function ranges(): Record<string, { min: number; max: number }> {
  const out: Record<string, { min: number; max: number }> = {
    exposure: range(-4, 4),
    contrast: range(0, 2),
    pivot: range(0, 1),
    highlights: range(-100, 100),
    shadows: range(-100, 100),
    whites: range(-100, 100),
    blacks: range(-100, 100),
    temperature: range(-100, 100),
    tint: range(-100, 100),
    vibrance: range(-100, 100),
    saturation: range(0, 2),
    hue: range(-180, 180),
    rolloff: range(0, 100),
    "log.lowRange": range(0, 1),
    "log.highRange": range(0, 1),
    "mix.range": range(0, 100),
    "warper.smoothing": range(0, 100),
    "creative.shadowTint.x": range(-1, 1),
    "creative.shadowTint.y": range(-1, 1),
    "creative.highlightTint.x": range(-1, 1),
    "creative.highlightTint.y": range(-1, 1),
    "creative.balance": range(-100, 100),
    "creative.fade": range(0, 100),
    "creative.vignette.amount": range(-100, 100),
    "creative.vignette.midpoint": range(0, 100),
    "creative.vignette.roundness": range(-100, 100),
    "creative.vignette.feather": range(0, 100),
    "mixer.matrix": range(-2, 2),
    skinPull: range(0, 100),
  };
  const wheels = ["lift", "gamma", "gain", "offset", "log.shadow", "log.midtone", "log.highlight"];
  for (const name of ZONE_NAMES) wheels.push(`zones.${name}`);
  for (const path of wheels) for (const f of ["x", "y", "m"]) out[`${path}.${f}`] = range(-1, 1);
  for (const name of ZONE_NAMES) out[`zones.${name}.at`] = range(0, 1);
  for (const name of MIX_FAMILIES) {
    for (const f of ["hue", "sat", "lum"]) out[`mix.${name}.${f}`] = range(-100, 100);
  }
  return out;
}

/** The smallest and largest of every number of a correction, by dotted field path (`lift.x`). */
export const GRADE_RANGES: Record<string, { min: number; max: number }> = ranges();

/** A clip's grade, or null when it has none (the picture as the file is). */
export function gradeOf(clip: Pick<Clip, "grade">): ClipGrade | null {
  return clip.grade ?? null;
}

function isPlain(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** `over` laid on `base`, going into plain objects only (arrays and numbers are replaced). */
function overlay(base: unknown, over: unknown): unknown {
  if (!isPlain(base) || !isPlain(over)) return over === undefined ? base : over;
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(over)) out[key] = overlay(base[key], value);
  return out;
}

/** A correction's values: its own over the defaults. A stored value may be partial (a keyed one), so the rest fills in. */
export function correctionOf(node: Correction): CorrectionValues {
  if (!node.values) return DEFAULT_CORRECTION;
  return overlay(DEFAULT_CORRECTION, node.values) as CorrectionValues;
}

/**
 * The grade without what is only a default: values equal to `DEFAULT_CORRECTION` are dropped
 * (a wheel keeps its whole `{ x, y, m }` when any of it differs), and a graph of source straight
 * to out with no nodes is undefined, since an untouched clip has no grade.
 */
export function minimizeGrade(grade: ClipGrade): ClipGrade | undefined {
  const nodes: ClipGrade["nodes"] = {};
  for (const [id, node] of Object.entries(grade.nodes)) {
    if (node.kind !== "correct" || !node.values) {
      nodes[id] = node;
      continue;
    }
    const { values, ...rest } = node;
    const kept: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(values)) {
      const base = DEFAULT_CORRECTION[key as keyof CorrectionValues];
      if (JSON.stringify(value) !== JSON.stringify(base)) kept[key] = value;
    }
    nodes[id] =
      Object.keys(kept).length > 0 ? { ...rest, values: kept as Correction["values"] } : rest;
  }
  if (Object.keys(nodes).length === 0 && grade.out.node === "source" && !grade.out.channel) {
    if (grade.input !== undefined && grade.input !== "rec709") return { ...grade, nodes };
    return undefined;
  }
  const { input, ...rest } = grade;
  return input === undefined || input === "rec709" ? { ...rest, nodes } : { ...grade, nodes };
}

/**
 * Whether a clip can be graded: a picture (a video or an image file, or a composition) on a
 * video track. The one rule, for the Tint page and the commands.
 */
export function canGrade(clip: Clip, project: ProjectState): boolean {
  if (project.tracks[clip.trackId]?.kind !== "video") return false;
  if (clip.compositionRef !== undefined) return true;
  const kind = clip.mediaId === undefined ? undefined : project.media[clip.mediaId]?.kind;
  return kind === "video" || kind === "image";
}

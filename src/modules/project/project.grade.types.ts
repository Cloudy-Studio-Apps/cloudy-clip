import type { BlendMode, KeyTrack } from "./project.types";

export type GradeNodeId = string;
export type GradeGroupId = string;
export type LutId = string;
export type StillId = string;

/** Camera color space of a source; missing means Rec.709 (no conversion). */
export type InputColorSpace =
  "rec709" | "srgb" | "slog3" | "appleLog" | "clog2" | "clog3" | "vlog" | "flog";

/** A picture in the graph: the source's, or a node's. A `channel` only after a split. */
export interface NodeRef {
  node: GradeNodeId | "source";
  channel?: "r" | "g" | "b";
}

/** Where a node sits in Leader Seal, in graph units. Missing means auto-layout. */
export interface GradePos {
  x: number;
  y: number;
}

/** What a correction touches: the whole frame when missing. */
export interface GradeLimit {
  color?: {
    on: boolean;
    hue: [number, number];
    sat: [number, number];
    lum: [number, number];
    soft: number;
  };
  brightness?: { on: boolean; range: [number, number]; soft: number };
  refine?: { soft: number; clean: number };
  invert?: true;
  /** The shared key: another correction's pick, or a key join. */
  from?: GradeNodeId;
}

/** A wheel: x and y on the wheel, m the master ring. */
export interface Wheel {
  x: number;
  y: number;
  m: number;
}

/** A zone wheel and where its band sits (0 to 1). */
export interface ZoneWheel extends Wheel {
  at: number;
}

/** A curve: points `[x, y]` from 0 to 1, sorted by x. */
export type CurvePoints = [number, number][];

/** What a color-mix family moves. */
export interface MixFamily {
  hue: number;
  sat: number;
  lum: number;
}

/** The eight families of color mix, in hue order. */
export const MIX_FAMILIES = [
  "reds",
  "oranges",
  "yellows",
  "greens",
  "aquas",
  "blues",
  "purples",
  "magentas",
] as const;

/** One of {@link MIX_FAMILIES}. */
export type MixFamilyName = (typeof MIX_FAMILIES)[number];

/** The six zones of the zone wheels, dark to light. */
export const ZONE_NAMES = ["z0", "z1", "z2", "z3", "z4", "z5"] as const;

/** One of {@link ZONE_NAMES}. */
export type ZoneName = (typeof ZONE_NAMES)[number];

/** Every value of one correction. Stored only where it differs from `DEFAULT_CORRECTION`. */
export interface CorrectionValues {
  exposure: number;
  contrast: number;
  pivot: number;
  highlights: number;
  shadows: number;
  whites: number;
  blacks: number;
  temperature: number;
  tint: number;
  vibrance: number;
  saturation: number;
  hue: number;
  rolloff: number;
  protectSkin: boolean;
  lift: Wheel;
  gamma: Wheel;
  gain: Wheel;
  offset: Wheel;
  log: {
    shadow: Wheel;
    midtone: Wheel;
    highlight: Wheel;
    lowRange: number;
    highRange: number;
  };
  zones: Record<ZoneName, ZoneWheel>;
  curves: {
    rgb: { y: CurvePoints; r: CurvePoints; g: CurvePoints; b: CurvePoints };
    hueHue: CurvePoints;
    hueSat: CurvePoints;
    hueLum: CurvePoints;
    lumSat: CurvePoints;
  };
  mix: Record<MixFamilyName, MixFamily> & { range: number };
  warper: {
    /** Sparse offsets by index on the 12 x 3 hue-and-strength grid. */
    points: Record<string, { dh: number; ds: number }>;
    smoothing: number;
    pinned: number[];
  };
  creative: {
    shadowTint: { x: number; y: number };
    highlightTint: { x: number; y: number };
    balance: number;
    fade: number;
    vignette: { amount: number; midpoint: number; roundness: number; feather: number };
  };
  mixer: {
    /** Rows are output r, g, b; columns the input r, g, b. */
    matrix: [number, number, number][];
    keepBrightness: boolean;
    mono: boolean;
  };
  skinPull: number;
}

/** A correction: one grade of its input, with its values and where it applies. */
export interface Correction {
  kind: "correct";
  input: NodeRef;
  on: boolean;
  /** 0 to 1. */
  opacity: number;
  name?: string;
  values?: Partial<CorrectionValues>;
  limit?: GradeLimit;
  /** A LUT by id: an imported one (`ProjectState.luts`) or a built-in look. */
  lut?: { id: string; strength: number };
  pos?: GradePos;
}

/** Pictures added together. */
export interface ParallelJoin {
  kind: "parallel";
  inputs: NodeRef[];
  on: boolean;
  opacity: number;
  pos?: GradePos;
}

/** Pictures stacked, each over the one before with its blend mode. */
export interface LayerJoin {
  kind: "layer";
  inputs: NodeRef[];
  /** One per input. */
  blends: BlendMode[];
  on: boolean;
  opacity: number;
  pos?: GradePos;
}

/** A picture split into its r, g and b channels. */
export interface ChannelSplit {
  kind: "split";
  input: NodeRef;
  pos?: GradePos;
}

/** Three channels put back into a picture. */
export interface ChannelJoin {
  kind: "join";
  r: NodeRef;
  g: NodeRef;
  b: NodeRef;
  pos?: GradePos;
}

/** Keys combined into one (Leader Seal only). */
export interface KeyJoin {
  kind: "keyJoin";
  keys: { from: GradeNodeId; mode: "add" | "subtract" | "intersect" }[];
  pos?: GradePos;
}

/** A node of the grade graph. */
export type GradeNode =
  Correction | ParallelJoin | LayerJoin | ChannelSplit | ChannelJoin | KeyJoin;

/** A graph of nodes from the source to `out`. Never stored when it is just source to out. */
export interface ClipGrade {
  input?: InputColorSpace;
  /** Every node by id. Keyed paths go through ids: `grade.nodes.<id>.values.<field>`. */
  nodes: Record<GradeNodeId, GradeNode>;
  /** The node whose picture is the result. */
  out: NodeRef;
}

/** A grade kept under a version name while another is active. */
export interface StoredGradeVersion {
  grade?: ClipGrade;
  /** The clip's `grade.*` key tracks of that version. */
  animation?: Record<string, KeyTrack>;
}

/** A shot group: a grade that runs after the clip's own on every clip in it. */
export interface GradeGroup {
  id: GradeGroupId;
  name: string;
  grade?: ClipGrade;
}

/** A `.cube` LUT file, kept by path like media. */
export interface Lut {
  id: LutId;
  name: string;
  path: string;
  /** Grid size of the cube. */
  size: number;
}

/** A frame grabbed with its grade, to compare against or apply. */
export interface Still {
  id: StillId;
  name: string;
  /** A JPEG data URL, at most 320 px wide. */
  image: string;
  grade?: ClipGrade;
  from: { clipId?: string; time: number };
}

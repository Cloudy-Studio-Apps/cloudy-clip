import type { StoreApi } from "zustand";
import type { Micros } from "@/core";
import type {
  Clip,
  ClipId,
  CompositionId,
  CorrectionValues,
  GradeGroupId,
  GradeNode,
  GradeNodeId,
  NodeRef,
} from "@/modules/project";

/** How the grade is shown: as layers (Baby Seal) or as nodes (Leader Seal). */
export type TintMode = "baby" | "leader";

/** The tools in the rail, in rail order. */
export type ToolId =
  | "basics"
  | "wheels"
  | "curves"
  | "cmix"
  | "warper"
  | "creative"
  | "limit"
  | "luts"
  | "match"
  | "mixer";

/** The four ways the Wheels tool shows its wheels. */
export type WheelsMode = "primary" | "log" | "bars" | "zones";

/** Which grade the page edits: the clip's, its shot group's, or the whole timeline's. */
export type GradeLevel = "clip" | "group" | "timeline";

/** The main scope beside the vectorscope. */
export type ScopeKind = "parade" | "wave" | "hist";

/** The curve the Curves tool shows. */
export type CurveKind = "custom" | "hueHue" | "hueSat" | "hueLum" | "lumSat";

/** What the left panel shows. */
export type GradeTab = "grade" | "looks";

/** The page's view state, per kernel and never in history. */
export interface TintView {
  mode: TintMode;
  tool: ToolId;
  wheels: WheelsMode;
  level: GradeLevel;
  scope: ScopeKind;
  curve: CurveKind;
  leftTab: GradeTab;
  /** The clip being graded because it was clicked in the strip; null follows the playhead. */
  pinned: ClipId | null;
  /** The layer or node being edited. */
  selected: string | null;
  /** Index into the Color mix families. */
  family: number;
  bypass: boolean;
  compare: boolean;
  falseColor: boolean;
  warning: boolean;
  guides: boolean;
  samples: boolean;
  /** The viewer fills the window. */
  clean: boolean;
}

/** The tint module's API for one kernel. */
export interface TintApi {
  /** The page's view state. Read with `useStore(api.view, selector)`. */
  readonly view: StoreApi<TintView>;
  /** Values being dragged, drawn over the saved grade until cleared (never in history). */
  readonly live: TintLive;
  /** Whether the GPU can draw grades here (`PreviewApi.gpuAvailable`); the page says so when not. */
  readonly available: boolean;
  /** The clip being graded: the pinned one, else the gradeable clip under the playhead. */
  current(): ClipId | null;
  /** Calls `fn` when the current clip changes. Returns the unsubscribe. Compatible with `useSyncExternalStore`. */
  onCurrent(fn: (id: ClipId | null) => void): () => void;
  /** Where the playhead was last inside each clip, for coming back to it. */
  viewedAt(clipId: ClipId): Micros | undefined;
  /**
   * A small picture (a data URL) of the clip alone, at `time`, as its grade leaves `nodeId`.
   * Captures are taken one at a time. Rejects as `PreviewApi.captureAt` does.
   */
  thumb(
    clipId: ClipId,
    nodeId: GradeNodeId,
    time: Micros,
    compositionId: CompositionId,
  ): Promise<string>;
}

/** The current clip and where each clip was last viewed (`followCurrent` writes, `TintApi` reads). */
export interface CurrentClip {
  current(): ClipId | null;
  onCurrent(fn: (id: ClipId | null) => void): () => void;
  viewedAt(clipId: ClipId): Micros | undefined;
  set(id: ClipId | null): void;
  remember(clipId: ClipId, time: Micros): void;
}

/** One clip of the strip: a gradeable clip of a video track, tagged with its track's number. */
export interface StripClip {
  clip: Clip;
  /** `"V1"` for the top video track, `"V2"` below it, and so on. */
  track: string;
  /** Its place in the strip, `"01"`. */
  no: string;
}

/** A color, each channel 0 to 1 when in range: display-referred Rec.709. */
export type Rgb = [number, number, number];

/** Where a pixel is in the picture: `u` 0 (left) to 1, `v` 0 (bottom) to 1 (top), as `v_uv`. */
export interface PixelAt {
  u: number;
  v: number;
}

/** A node's live values: a correction's values being dragged, its opacity and whether it is on. */
export type LiveNode = Partial<CorrectionValues> & { opacity?: number; on?: boolean };

/** A clip's live values by node, laid over its saved grade. */
export interface LiveGrade {
  nodes: Record<GradeNodeId, LiveNode>;
}

/** Live values of every clip being edited, per kernel. */
export interface TintLive {
  /** The clip's live values, if any. */
  get(clipId: ClipId): LiveGrade | undefined;
  /** Sets a clip's live values, or clears them with null, and asks the preview to redraw. */
  set(clipId: ClipId, live: LiveGrade | null): void;
  /** Calls `fn` after each change. Returns the unsubscribe. */
  subscribe(fn: () => void): () => void;
}

/** One correction worked out once for every pixel: what its shader's uniforms hold. */
export interface CorrectionParams {
  /** Multiplies linear light: `2^exposure` times the white balance gain of each channel. */
  linear: Rgb;
  lift: Rgb;
  /** 1 / gamma of each channel. */
  gammaInv: Rgb;
  gain: Rgb;
  offset: Rgb;
  contrast: number;
  /** The pivot in the log-ish space. */
  pivot: number;
  /** Highlights, shadows, whites and blacks as the most each band moves a value. */
  bands: [number, number, number, number];
  /** Where rolloff starts; 1 is off. */
  knee: number;
  saturation: number;
  /** Vibrance, -1 to 1. */
  vibrance: number;
  /** cos and sin of the hue turn. */
  hue: [number, number];
  /** 1 protects skin hues from saturation, vibrance and hue, 0 doesn't. */
  skin: number;
}

/** A point in the node graph, in graph units. */
export type GraphPoint = readonly [number, number];

/** A node's place and shape in the graph. */
export interface GraphPlaced {
  kind: string;
  x: number;
  y: number;
}

/** A curve point, x and y in 0..1. */
export type CurvePoint = readonly [number, number];

/** The part of the node graph in view, in graph units (an SVG view box). */
export interface GraphView {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** One row of Baby Seal: a layer, a group of branches (`id` is its join), or a sealed card. */
export type StackItem =
  | { type: "layer"; id: GradeNodeId }
  | {
      type: "group";
      /** The join node. */
      id: GradeNodeId;
      kind: "parallel" | "layer" | "channels";
      /** One per join input (r, g, b for channels), each top to bottom. */
      branches: StackItem[][];
    }
  | {
      type: "sealed";
      /** `"sealed:<first node>"`. */
      id: string;
      /** Every node inside, in evaluation order. */
      nodes: GradeNodeId[];
    };

/** A place in the stack: before or after an item, or at the bottom of a group's branch (or of the stack). */
export interface StackPosition {
  before?: GradeNodeId;
  after?: GradeNodeId;
  branch?: { group: GradeNodeId; index: number };
}

/** A part of the graph Baby Seal can't show: the picture `entry` in, `exit` out, and the nodes between. */
export interface SealedRegion {
  entry: NodeRef;
  exit: GradeNodeId;
  nodes: GradeNodeId[];
}

/** Where a list of the stack ends: `out`, a join's input, or a channel join's channel. */
export type StackSink =
  | { kind: "out" }
  | { kind: "input"; node: GradeNodeId; index: number }
  | { kind: "channel"; node: GradeNodeId; channel: "r" | "g" | "b" };

/** An item of a list with the picture it reads, the picture it gives and its nodes on the path. */
export interface StackEntry {
  item: StackItem;
  entry: NodeRef;
  exit: NodeRef;
  nodes: GradeNodeId[];
}

/** One list of the stack (the top level or a group's branch), from its entry to its sink. */
export interface StackList {
  entry: NodeRef;
  sink: StackSink;
  entries: StackEntry[];
}

/** A grade read as a stack: the items, every list with its wiring, and the sealed regions. */
export interface StackParse {
  items: StackItem[];
  lists: StackList[];
  sealed: SealedRegion[];
}

/** A grade's graph prepared for reading: evaluation order and the nodes between source and out. */
export interface GradeGraph {
  nodes: Record<GradeNodeId, GradeNode>;
  /** Index of each node in `topoOrder`; `"source"` is -1. */
  index: Map<string, number>;
  /** Nodes on a picture path from the source to `out`. */
  onPath: Set<GradeNodeId>;
  /** The grade's `out`. */
  out: NodeRef;
  /** Picture consumers of each vertex (`"source"` included), on the path only. */
  succ: Map<string, Set<GradeNodeId>>;
}

/** Corrections whose key the stack can't show, and the off-path nodes their key comes through. */
export interface KeyCluster {
  members: Set<GradeNodeId>;
  extras: Set<GradeNodeId>;
}

/** A branch of a group found in the graph, before it is read as a list. */
export interface StackBranch {
  /** The branch's vertices with its entry vertex. */
  within: Set<string>;
  entry: NodeRef;
  /** The branch's last node, or the entry vertex when empty. */
  exit: string;
  sink: StackSink;
}

/** One step along a list: from the vertex `cur` to `exit`, owning the nodes between and `exit`. */
export interface StackPair {
  entry: NodeRef;
  exit: string;
  owned: Set<GradeNodeId>;
  shape:
    | { type: "layer" }
    | { type: "group"; kind: "parallel" | "layer" | "channels"; branches: StackBranch[] }
    | null;
}

/** Which grade a command edits: a clip's, a shot group's, or a composition's whole-frame one. */
export type GradeTarget =
  { clipId: ClipId } | { groupId: GradeGroupId } | { compositionId: CompositionId };

/** What a layer's chip says it changes: the whole picture, picked colors, or a LUT. */
export interface LayerChipInfo {
  kind: "whole" | "key" | "lut";
  label: string;
}

/** A layer row's place on screen while one is dragged, in visual order. */
export interface DropRow {
  id: GradeNodeId;
  top: number;
  bottom: number;
  /** Inside a group (not at the top level of the stack). */
  nested: boolean;
}

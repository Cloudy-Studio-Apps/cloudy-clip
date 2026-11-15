import type { StoreApi } from "zustand";
import type { Micros } from "@/core";
import type { GpuTexture } from "@/modules/preview";
import type {
  BlendMode,
  Clip,
  ClipId,
  Correction,
  CompositionId,
  CorrectionValues,
  GradeGroupId,
  GradeLimit,
  GradeNode,
  GradeNodeId,
  KeyJoin,
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

/**
 * How a curve behaves in the editor: `tone` (a custom curve, neutral on the diagonal), `flat`
 * (Brightness vs Saturation, neutral at 0.5) or `hue` (neutral at 0.5, wrapping at 1).
 */
export type CurveShape = "tone" | "flat" | "hue";

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
  falseColor: boolean;
  warning: boolean;
  guides: boolean;
  samples: boolean;
  /** The viewer fills the window. */
  clean: boolean;
  /** The viewer waits for one click to pick a color (Curves' Pick hue, Color mix's Pick, Limit's droppers); Escape stops it. */
  picking: boolean;
  /** The color the viewer picked (what the edited correction reads there), until the open tool takes it. */
  picked: Rgb | null;
  /** The correction whose key the live preview shows instead of its picture (Limit's Show), or null. */
  showPicked: GradeNodeId | null;
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
  /**
   * The color the correction `nodeId` reads at a point of the viewer's frame (0…1): the clip
   * captured alone and ungraded at the playhead, run through the corrections before that node
   * with the CPU reference (`nodeId` null: through the whole grade). Null when the point is off
   * the clip's picture. Rejects as `PreviewApi.captureAt` does. For pickers (Pick hue, Color mix's
   * Pick, Limit's droppers, and later Match).
   */
  pickColor(clipId: ClipId, nodeId: GradeNodeId | null, point: FramePoint): Promise<Rgb | null>;
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

/**
 * Where a pixel is in the clip's own picture: `u` 0 (left) to 1, `v` 0 (bottom) to 1 (top), as the
 * shader's `v_uv` has it (the runner uploads the picture with its top at `v_uv.y = 1`), and the
 * picture's `aspect` (width over height), which the vignette needs to draw a circle.
 */
export interface PixelAt {
  u: number;
  v: number;
  aspect: number;
}

/** A point of the composition's frame: `u` 0 (left) to 1, `v` 0 (top) to 1 (bottom). */
export interface FramePoint {
  u: number;
  v: number;
}

/** Pixels read back from a picture: RGBA bytes, row by row from the top (an `ImageData`). */
export interface PickFrame {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

/**
 * A node's live values: a correction's values being dragged, its opacity, whether it is on, and its
 * limit (null: none); or a group's opacity, on and blends.
 */
export type LiveNode = Partial<CorrectionValues> & {
  opacity?: number;
  on?: boolean;
  limit?: GradeLimit | null;
  /** A stacked group's blends, one per branch. */
  blends?: BlendMode[];
};

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
  /**
   * Whether the custom curves and the hue and brightness curves (Color mix folded in) change
   * anything (1) or not (0).
   */
  curveOn: [number, number];
  /** The curves sampled with Color mix (`sampleCurves`), or null when the curve step changes nothing. */
  curveTable: Float32Array | null;
  /** The warper sampled (`sampleWarper`), or null when it moves nothing. */
  warpTable: Float32Array | null;
  /** The log wheels, or null when they move nothing. */
  log: LogParams | null;
  /** The zone wheels, or null when they move nothing. */
  zones: ZoneParams | null;
  /** How far skin hues turn toward the skin line, 0 (off) to `SKIN_PULL_REACH`. */
  skinPull: number;
  /** The RGB mixer, or null when it changes nothing. */
  mixer: MixerParams | null;
  /** Split toning, or null when both tints are at the middle. */
  split: SplitParams | null;
  /** Faded film, 0 (off) to 1. */
  fade: number;
  /** The vignette, or null when its amount is 0. */
  vignette: VignetteParams | null;
}

/** The log wheels worked out: what each adds to each channel, and the edges of their ranges. */
export interface LogParams {
  shadow: Rgb;
  midtone: Rgb;
  highlight: Rgb;
  /** Where the shadow wheel has faded out, over luma (`lowRange`, kept off 0). */
  low: number;
  /** Where the highlight wheel starts (`highRange`, kept off 1). */
  high: number;
}

/** The zone wheels worked out: what each of the six adds to each channel, and where its band sits. */
export interface ZoneParams {
  /** Six times r, g, b, dark to light. */
  add: number[];
  /** The middle of each band, over luma. */
  at: number[];
}

/** The RGB mixer worked out: the matrix (rows out, columns in, row by row), brightness kept in it. */
export interface MixerParams {
  matrix: number[];
  mono: boolean;
}

/** Split toning worked out: what each tint adds to each channel, and the luma between them. */
export interface SplitParams {
  shadow: Rgb;
  highlight: Rgb;
  pivot: number;
}

/** The vignette worked out: amount -1 to 1, its edge's middle and width over the distance, roundness -1 to 1. */
export interface VignetteParams {
  amount: number;
  center: number;
  width: number;
  round: number;
}

/** A table baked for the shader: the texture and the table it holds. */
export interface BakedTable {
  texture: GpuTexture;
  table: Float32Array;
}

/**
 * Bakes a picture filter's lookup tables, each again only when what it is made of changes
 * (`render/textures.ts`).
 */
export interface GradeTextures {
  /** The curve step of the correction `key` (curves and Color mix), or null when it changes nothing. */
  curves(values: CorrectionValues, key: string): BakedTable | null;
  /** The warper of the correction `key`, or null when it moves nothing. */
  warper(warper: CorrectionValues["warper"], key: string): BakedTable | null;
}

/** Color mix as hue curves (`mixToHueCurves`), folded into the correction's own when sampled. */
export interface MixCurves {
  hueHue: CurvePoint[];
  hueSat: CurvePoint[];
  hueLum: CurvePoint[];
}

/** How far the warper moves a color: `dh` in turns of hue, `ds` in strength (1 = chroma 0.5). */
export interface WarpOffset {
  dh: number;
  ds: number;
}

/** A place on the warper's disc: hue in turns from red, strength 0 (gray) to 1 (chroma 0.5) and on. */
export interface WarpPlace {
  hue: number;
  strength: number;
}

/** A point in the node graph, in graph units. */
export type GraphPoint = readonly [number, number];

/** A node's place and shape in the graph. */
export interface GraphPlaced {
  kind: string;
  x: number;
  y: number;
}

/** A wire of the node graph, with where it starts and ends in graph units. */
export interface GraphWire {
  /** Where it starts: a node id or `"source"`. */
  from: string;
  /** Where it ends: a node id or `"out"`. */
  to: string;
  /** `r`, `g`, `b`: a channel; `key`: a key (dashed). */
  kind: "picture" | "r" | "g" | "b" | "key";
  /** Its place among what `to` reads: the picture inputs, or (a key wire) the keys. */
  index: number;
  a: GraphPoint;
  b: GraphPoint;
}

/** A dashed box around the nodes Baby Seal shows as one thing, in graph units. */
export interface GraphRegion {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Where a wire dropped: a node (and, on a channel join, which channel) or the graph's `out`. */
export interface WireDrop {
  nodeId: string;
  channel?: "r" | "g" | "b";
}

/** One entry of `tint.wire`'s `set`. */
export interface WireEntry {
  nodeId: string;
  input?: NodeRef;
  inputs?: NodeRef[];
  r?: NodeRef;
  g?: NodeRef;
  b?: NodeRef;
  keys?: KeyJoin["keys"];
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

/** The scopes `scopeData` bins a frame for. */
export type ScopeBinning = "parade" | "wave" | "hist" | "vector";

/** One channel's summary, 0..255. */
export interface ChannelStats {
  min: number;
  max: number;
  mean: number;
}

/** What a frame measures: see `scopeStats`. */
export interface ScopeStats {
  r: ChannelStats;
  g: ChannelStats;
  b: ChannelStats;
  clipped: { low: number; high: number };
  histogram: number[];
  skinDistance: number;
}

/**
 * A limit worked out for every pixel (`prepareLimit`), what the key pass's uniforms hold. Hue in
 * turns of the hue curves' circle; saturation a share of full chroma; brightness luma.
 */
export interface LimitParams {
  /** The hue window: its middle, half its width and the soft edge; null when not limited by color. */
  hue: [number, number, number] | null;
  /** The saturation window: from, to, soft edge. Read only with `hue`. */
  sat: [number, number, number];
  /** The brightness window of the color part: from, to, soft edge. Read only with `hue`. */
  lum: [number, number, number];
  /** The brightness part's window: from, to, soft edge; null when not limited by brightness. */
  bright: [number, number, number] | null;
  /** How far the key is blurred, as a share of the picture's height (0: not blurred). */
  radius: number;
  /** Clean up's threshold, 0 (off) to `CLEAN_REACH`. */
  clean: number;
  invert: boolean;
}

/** A range bar's window, two ends as shares of the bar (0…1); `from > to` wraps on a hue bar. */
export type RangeWindow = [number, number];

/** What a range bar's drag holds: one end or the whole window. */
export type RangePart = "from" | "to" | "move";

/** What Limit's dropper does with the next pick: set the ranges around it, add it, or leave it out. */
export type LimitPick = "pick" | "add" | "cut";

/** The key a correction mixes by (`sharedKey`): whose key pass it reads, and how it is finished. */
export interface SharedKey {
  /** The correction whose pick it is (the node itself, or the one its `limit.from` leads to), or the key join it leads to. */
  owner: GradeNodeId;
  /** That pick's windows and blur, with clean up and the invert as this correction reads them. */
  params: LimitParams;
}

/** Why a correction can't take its key from a node (`keyProblem`). */
export type KeyProblem = "missing" | "not_limited" | "cycle" | "not_above" | null;

/** What a picture through the grade is made of, for `walkGrade`: GPU passes or a CPU pixel. */
export interface GradeOps<P, K> {
  /** The picture coming in. */
  source: P;
  /** One channel of a picture, as gray (what a branch of a per-channel group reads). */
  channel(picture: P, channel: "r" | "g" | "b"): P;
  /** The raw key of a limit read from `input` (before clean up and invert). */
  key(params: LimitParams, input: P): K;
  /** A correction that is on and shows, over `input`, mixed by its key when it has one. */
  correct(
    id: GradeNodeId,
    node: Correction,
    input: P,
    key: { key: K; params: LimitParams } | null,
  ): P;
  /** Side by side: `entry + opacity · Σ (branchᵢ − entry)`. */
  parallel(entry: P, branches: P[], opacity: number): P;
  /** Stacked: each branch over the picture so far by its blend, from `entry`, mixed by opacity. */
  layer(entry: P, branches: P[], blends: BlendMode[], opacity: number): P;
  /** Red of `r`, green of `g`, blue of `b`. */
  join(r: P, g: P, b: P): P;
  /**
   * A key join: each entry's key finished by its params (null: a key that limits nothing, 1),
   * combined in order by its mode. The result is finished already.
   */
  keyJoin(
    keys: { key: { key: K; params: LimitParams } | null; mode: KeyJoin["keys"][number]["mode"] }[],
  ): K;
}

/** A grade being walked: each picture and key worked out once, on demand. */
export interface GradeWalk<P, K> {
  /** The picture at a ref. */
  picture(ref: NodeRef): P;
  /** The key a correction mixes by, or null. */
  key(id: GradeNodeId): { key: K; params: LimitParams } | null;
}

/** What a group of the stack holds (`groupOf`). */
export interface StackGroupInfo {
  /** Every correction inside it, nested groups included. */
  corrections: GradeNodeId[];
  /** A per-channel group's split. */
  split?: GradeNodeId;
}

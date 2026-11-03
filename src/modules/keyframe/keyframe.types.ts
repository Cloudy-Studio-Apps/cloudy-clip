import type { StoreApi } from "zustand";
import type { ActorId, CommandContext, Micros } from "@/core";
import type { ScreenBox } from "@/modules/timeline";
import type { MenuItem } from "@/ui";
import type {
  Clip,
  ClipId,
  EasePresetId,
  KeyEase,
  Keyframe,
  KeyTrack,
  KeyValue,
  Track,
} from "@/modules/project";

/** The new state of some tracks of one clip; undefined removes the track. */
export interface TrackEdit {
  clipId: string;
  tracks: Record<string, KeyTrack | undefined>;
  /** Where a track is gone: the value its field keeps as the static value. */
  statics?: Record<string, KeyValue>;
}

/** A cubic bezier ease: the shape the curve handles edit. */
export type Bezier = Extract<KeyEase, { kind: "bezier" }>;

/** Whether the keyed paths of a row have keys: none, some, or one on the playhead's frame. */
export type KeyState = "off" | "animated" | "on-key";

/** What the panel's buttons, keys and menus do to the selected keys. Each reports a failure with `notify`. */
export interface KeyActions {
  copy(): void;
  remove(): void;
  /** Flips the selection around its middle, reversing its curves. */
  reverse(): void;
  /** Gives every selected key a preset curve. */
  ease(id: EasePresetId): void;
}

/** What the panel's buttons and keys do to the key selection. Each reports a failure with `notify`. */
export interface PanelActions extends KeyActions {
  paste(): void;
  selectAll(): void;
  fit(): void;
}

/** One key of one track of one clip. */
export interface KeyRef {
  clipId: ClipId;
  path: string;
  keyId: string;
}

/** A value of a clip that can hold keys, as a target declares it. */
export interface KeyField {
  path: string;
  label: string;
  blend: KeyTrack["blend"];
  shared?: true;
  min?: number;
  max?: number;
  /** enum: the allowed values. */
  values?: readonly string[];
  /** False where a track can't loop (speed). */
  loops?: false;
  /** The value now, with `clip` already at the time wanted. */
  read(clip: Clip): KeyValue;
  /** Makes `value` the static value, for when the last key goes. */
  commitStatic(ctx: CommandContext, clipId: ClipId, value: KeyValue): Promise<unknown>;
}

/** Something whose values can be keyed: the element's fields, or a module's own (speed). */
export interface KeyTarget {
  id: string;
  fields(clip: Clip, track: Track): readonly KeyField[];
  /** Runs in the same command, after a track of this target changed. */
  afterWrite?(ctx: CommandContext, clipId: ClipId, before: Clip): void | Promise<void>;
}

/** The keyframe module's API. */
export interface KeyframeApi {
  /** Every field of a clip that can be keyed. */
  fieldsOf(clip: Clip): readonly KeyField[];
  /** One field of a clip with the target that owns it, or undefined when it can't be keyed. */
  fieldOf(clip: Clip, path: string): { target: KeyTarget; field: KeyField } | undefined;
  readonly view: StoreApi<KeyframeViewState>;
  /** What each actor copied. Never in history. */
  readonly clipboard: KeyframeClipboard;
}

/** One copied key: its path, its content-time distance from the earliest copied key, and its look. */
export interface CopiedKey {
  path: string;
  offset: Micros;
  value: KeyValue;
  ease?: KeyEase;
  smooth?: true;
}

/** What an actor copied. */
export interface CopiedKeys {
  keys: readonly CopiedKey[];
}

/** Per actor, so an agent's copy doesn't replace the user's. */
export interface KeyframeClipboard {
  get(actor: ActorId): CopiedKeys | undefined;
  set(actor: ActorId, copied: CopiedKeys): void;
}

/** How the keyframe panel looks, per kernel and never in history. */
export interface KeyframeViewState {
  mode: "normal" | "keys" | "curves";
  /** The view K goes back to. */
  last: "keys" | "curves";
  maximized: boolean;
  scope: "selected" | "all";
  folded: ClipId[];
  selection: KeyRef[];
  /** `clipId:path` of curves on show. */
  shown: string[];
  primary: string | null;
  panelHeight: number;
  /** The last click was in the panel. */
  focused: boolean;
  /** Draw the selected clip's position path on the canvas. */
  motionPath: boolean;
}

/** A clip the panel lists, with the fields that have keys. */
export interface PanelClip {
  clip: Clip;
  fields: readonly KeyField[];
}

/** What a drag of keys snaps to, in timeline time. */
export interface KeySnap {
  /** Times that pull a moving key: the playhead, clip ends, other keys. Empty with Ctrl held. */
  targets: readonly Micros[];
  /** One frame of the clip's format; moved keys land on whole frames. */
  frame: Micros;
}

/** A stretch of timeline time. */
export interface KeySpan {
  start: Micros;
  end: Micros;
}

/** What the panel draws of the timeline: its scale and the time span of the pages around the view. */
export interface PanelWindow {
  pxPerSecond: number;
  from: Micros;
  to: Micros;
}

/** One key as the panel draws it: where it sits on the timeline, and whether the clip covers it. */
export interface WindowKey {
  key: Keyframe;
  time: Micros;
  /** False past the clip's ends. */
  inside: boolean;
}

/** A selected key as the move limits see it: its timeline time and its clip's span. */
export interface MovedKey {
  time: Micros;
  clipStart: Micros;
  clipEnd: Micros;
}

/** A diamond on screen, with the key it stands for. */
export interface KeyBox {
  ref: KeyRef;
  box: ScreenBox;
}

/** What a drag of keys needs. */
export interface KeyDragOptions {
  /** The press that starts the drag. */
  event: PointerEvent;
  /** The panel; diamonds are found in it once, at the start. */
  root: HTMLElement;
  pxPerSecond: number;
  /** The keys that move, with their limits. */
  keys: readonly { ref: KeyRef; moved: MovedKey }[];
  /** Snapping, asked at each move; `targets` is empty while Ctrl is held. */
  snap(ctrl: boolean): KeySnap;
  /** Called on release with the clamped delta (never 0). */
  onDrop(delta: Micros): void;
  /** Called on release when the pointer never left the press (a click, not a drag). */
  onClick?(): void;
}

/** What a rubber band needs. */
export interface BoxSelectOptions {
  event: PointerEvent;
  root: HTMLElement;
  /** Called on release with the box on screen. */
  onDone(box: ScreenBox): void;
}

/** How a curve's values sit on screen: value to y and back, over the range the curve covers. */
export interface ValueScale {
  toY(value: number): number;
  toValue(y: number): number;
  /** The least and greatest value the plane shows. */
  low: number;
  high: number;
}

/** A curve on show, before it has a scale: its track, its color slot and whether it is the primary. */
export interface CurveSource {
  /** `clipId:path`, as `view.shown` keeps it. */
  id: string;
  clip: Clip;
  path: string;
  track: KeyTrack;
  /** Index into `CURVE_COLORS`. */
  slot: number;
  primary: boolean;
}

/** A curve ready to draw. */
export interface ShownCurve extends CurveSource {
  scale: ValueScale;
}

/** What `drawCurves` paints. Sizes are CSS px; the caller scales the context for the device. */
export interface CurveScene {
  curves: readonly ShownCurve[];
  pxPerSecond: number;
  scrollLeft: number;
  width: number;
  height: number;
  /** `clipId|path|keyId` of the selected keys. */
  selection: ReadonlySet<string>;
}

/** A selected key a curve drag moves: where it starts, the limits of its time and its scale. */
export interface CurveDragKey {
  ref: KeyRef;
  moved: MovedKey;
  scale: ValueScale;
  value: number;
  min?: number;
  max?: number;
}

/** Where a curve drag stands: the time delta and the new value of each key whose value changed, by `refId`. */
export interface CurveDragState {
  delta: Micros;
  values: ReadonlyMap<string, number>;
}

/** What a drag of keys on the graph needs. */
export interface CurveDragOptions {
  event: PointerEvent;
  pxPerSecond: number;
  keys: readonly CurveDragKey[];
  /** Snapping, asked at each move; `targets` is empty while Ctrl is held. */
  snap(ctrl: boolean): KeySnap;
  /** On the next frame after the pointer moved; `undefined` when the drag is cancelled. */
  onPreview(state: CurveDragState | undefined): void;
  /** On release, when something changed. */
  onDrop(state: CurveDragState): void;
  /** On release when the pointer never left the press. */
  onClick?(): void;
}

/** What the graph's drawing and pointer read, kept current without re-attaching listeners. */
export interface GraphState {
  sources: readonly CurveSource[];
  selected: ReadonlySet<string>;
  /** A drag in progress: the sources as it shows them, and the scales it began with. */
  preview?: { sources: readonly CurveSource[]; frozen: ReadonlyMap<string, ValueScale> };
}

/** A place on a curve: a time on the clip's content and a value. */
export interface Point {
  t: number;
  v: number;
}

/** One change of `keyframe.setEase`. */
export interface EaseChange {
  key: KeyRef;
  ease?: KeyEase | EasePresetId;
  smooth?: boolean;
}

/** A segment between two keys as its handles see it: its time span and value change, and its ease. */
export interface SegmentShape {
  /** Time from the left key to the right one (any consistent unit). */
  dt: number;
  dv: number;
  ease: KeyEase;
}

/** The segments on either side of a key: the one before it and the one after it. */
export interface SegmentPair {
  prev: SegmentShape;
  next: SegmentShape;
}

/** A handle of a selected key on screen, with what dragging it needs. */
export interface HandleSpot {
  /** The selected key the handle belongs to. */
  key: KeyRef;
  /** `in` is on the key's left (the previous key's ease), `out` on its right (its own). */
  side: "in" | "out";
  /** The key whose ease the handle edits. */
  owner: KeyRef;
  /** Timeline times of the owner and of the key after it. */
  start: Micros;
  end: Micros;
  /** Value of the owner, and the value change to the next key. */
  from: number;
  dv: number;
  /** The ease being edited, always a bezier. */
  ease: KeyEase;
  /** Where the handle and its key sit in the plane, in px. */
  x: number;
  y: number;
  anchor: { x: number; y: number };
  /** On a smooth key, the key whose ease follows this handle and both segments around the key. */
  follow?: { owner: KeyRef; segments: SegmentPair };
}

/** The eases a handle drag sets, by the `clipId|path|keyId` of the key that owns each. */
export type HandleState = ReadonlyMap<string, KeyEase>;

/** What a drag of a handle needs. */
export interface HandleDragOptions {
  event: PointerEvent;
  /** The eases for a pointer moved by this much from the press, in px. */
  resolve(dx: number, dy: number): HandleState;
  /** On the next frame after the pointer moved; `undefined` when the drag is cancelled. */
  onPreview(state: HandleState | undefined): void;
  /** On release, when the pointer moved. */
  onDrop(state: HandleState): void;
}

/** A place in the frame, in output pixels. */
export interface FramePoint {
  x: number;
  y: number;
}

/** A clip's position over time: sampled points, and where each key time sits with its keys. */
export interface MotionPathShape {
  points: FramePoint[];
  /** One per distinct key time of `transform.x` and `transform.y`: the keys there and the position. */
  keys: { ref: KeyRef[]; at: FramePoint }[];
}

/** What a drag of a path diamond needs. */
export interface MotionDragOptions {
  event: PointerEvent;
  /** The element the overlay fills; output pixels are found from its box. */
  frame: HTMLElement;
  /** The frame size in output pixels. */
  size: { width: number; height: number };
  /** The diamond that moves, and where it starts. */
  diamond: HTMLElement;
  at: FramePoint;
  /** The axes with a key here; the diamond moves only along those, as the keys will. */
  axes: { x: boolean; y: boolean };
  /** On release with the move in output pixels (never 0, 0). */
  onDrop(delta: FramePoint): void;
}

/** What a right click offers: on selected keys, and on a row. */
export interface KeyMenus {
  /** Reverse keys, Copy, Delete and the presets, for the selected keys. */
  selection(): readonly MenuItem[];
  /** What the row does after its last key, and Remove animation. */
  row(clip: Clip, field: KeyField): readonly MenuItem[];
}

/** What a stretch of the selected keys needs. Times are timeline times. */
export interface StretchOptions {
  event: PointerEvent;
  pxPerSecond: number;
  /** The end that stays. */
  anchor: Micros;
  /** The end the pointer holds. */
  grabbed: Micros;
  /** On each move with the factor; `undefined` when it ends or is cancelled. */
  onPreview(factor: number | undefined): void;
  /** On release, when the factor isn't 1. */
  onDrop(factor: number): void;
}

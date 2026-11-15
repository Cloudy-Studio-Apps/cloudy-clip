import type { StoreApi } from "zustand/vanilla";
import type { CommandBus, Micros, PagesState } from "@/core";
import type {
  BusId,
  Clip,
  CompositionId,
  KeyTrack,
  ProjectApi,
  ProjectState,
  TrackId,
} from "@/modules/project";
import type { PreviewApi } from "@/modules/preview";
import type { WorkspaceApi } from "@/modules/workspace";
import type { SoundViewState } from "./sound.types";

/**
 * How a track's fader writes its volume line while playing: Read plays the line only; Touch
 * writes while the fader is held and returns to the line on release; Latch writes from the first
 * touch until playback stops. View state, never in history.
 */
export type AutomationMode = "read" | "touch" | "latch";

/**
 * The pointer tool on the Sound page's lanes: Select (move, trim, fade handles), Cut (the blade),
 * Fade (drag a clip's edge), Draw volume, or Scrub.
 */
export type SoundTool = "select" | "cut" | "fade" | "draw" | "scrub";

/** A cut with the blade: one clip where it was clicked, or (Shift) every clip under that time. */
export interface BladeCut {
  bus: CommandBus;
  /** The audio clips of the open composition (the Sound page's scope). */
  clips: readonly Clip[];
  /** The clip clicked, or null over none. */
  hit: Clip | null;
  /** The cut time, snapped as a split is. */
  at: Micros;
  /** Shift: every clip under `at`, on every track. */
  every: boolean;
}

/** A fade dragged from a clip's edge on the Sound page's lanes. */
export interface FadeDrag {
  down: PointerEvent;
  bus: CommandBus;
  clip: Clip;
  /** The clip's box on screen. */
  box: DOMRect;
  pxPerSecond: number;
  /** Shows the fade's width over the clip with `style`, or hides it (null). */
  show(box: { left: number; width: number } | null): void;
}

/** A level written at a timeline time: a point of a stroke or of a fader pass. */
export interface LevelAt {
  /** Timeline time. */
  at: Micros;
  db: number;
}

/** One stretch of a fader pass: its points replace the line from `from` to `to`. */
export interface PassSpan {
  from: Micros;
  to: Micros;
  points: LevelAt[];
}

/** What the automation writer tells the page: the tracks (and the master) whose pass is being written. */
export interface AutomationState {
  writing: LineTarget[];
}

/**
 * Turns fader moves into a volume line while playing, per kernel: a track's, or the master's of
 * the open composition (`"master"`). In Touch, holding the
 * fader writes; in Latch, writing goes on after the release until playback stops. The fader is an
 * offset on the line: a pass writes the line raised or lowered by how far the fader moved. Each
 * pass is sent as one `sound.writePasses` when it ends (stop, a change of mode, leaving the page
 * or the composition, the project being left).
 */
export interface AutomationWriter {
  state: StoreApi<AutomationState>;
  /** The fader was pressed at `db`. True when the press writes the line (Touch or Latch, playing). */
  press(target: LineTarget, db: number): boolean;
  /**
   * The fader of a writing press moved to `db`: heard at once, written each frame. With its pass
   * ended (playback stopped under the hold) it's still heard, and writes again once playing.
   */
  move(target: LineTarget, db: number): void;
  /**
   * The fader of a writing press was let go: Touch returns to the line and stops writing until the
   * next press (its pass still sent once, at stop), Latch keeps writing.
   */
  release(target: LineTarget): void;
  /** The fader level a pass holds for the target, or null when none does (Touch let go). */
  level(target: LineTarget): number | null;
  /** Ends every pass, sending what each wrote. */
  finish(): Promise<void>;
  /**
   * Drops every pass, sending nothing, and stops following playback, the page and the project.
   * For the module's teardown: leaving the project sends them first (`beforeLeave`).
   */
  dispose(): void;
}

/** What the automation writer needs. */
export interface AutomationDeps {
  bus: CommandBus;
  preview: PreviewApi;
  project: ProjectApi;
  workspace: WorkspaceApi;
  pages: StoreApi<PagesState>;
  view: StoreApi<SoundViewState>;
}

/** A pass being written on one track or the master. */
export interface AutomationPass {
  mode: AutomationMode;
  /** The composition open when the pass began: the master's it writes. */
  compositionId: CompositionId | null;
  /** The fader volume when the pass began: the offset the line sits under. */
  offset: number;
  /** The fader level held now. */
  level: number;
  /** The fader is held. A Touch pass let go writes nothing until it's pressed again. */
  held: boolean;
  /**
   * The track's volume line when the pass began. Every lap writes relative to it, so a loop going
   * round never adds the pass to itself.
   */
  snapshot: KeyTrack | undefined;
  /**
   * The stretches written, one per lap (a seek or the loop going round starts the next), each in
   * time order; the last is being written. Sent together when the pass ends, a later lap winning
   * where they overlap.
   */
  laps: LevelAt[][];
  /** Some level written differs from the line: there is something to send. */
  changed: boolean;
}

/** A stroke drawn over a lane with Draw volume, in screen coordinates. */
export interface StrokeDrag {
  down: PointerEvent;
  /** Every move, with the stroke so far. */
  onMove(points: readonly StrokePoint[]): void;
  /** The release with the stroke, or null on Escape or a cancel. */
  onEnd(points: readonly StrokePoint[] | null): void;
}

/** A point of a stroke, on screen. */
export interface StrokePoint {
  clientX: number;
  clientY: number;
}

/** What a mixer strip addresses: an audio track, a group (its `BusId`), or the master. */
export type MixTarget = TrackId | BusId | "master";

/** What has a volume line: an audio track, or the master of a composition. */
export type LineTarget = TrackId | "master";

/** A volume line found for a command (`lineOwner`): the line, how close two keys merge, and how to write it. */
export interface LineOwner {
  line: KeyTrack | undefined;
  /** Half a frame of its composition, in µs. */
  tolerance: Micros;
  /** Stores `line` on the owner in `draft`, or removes it when it has no keys. */
  write(draft: ProjectState, line: KeyTrack | undefined): void;
}

/** A point of a clip's volume line: `x` in px from the clip's left edge, `db` the level. */
export interface LinePoint {
  x: number;
  db: number;
}

/** A key of the clip's volume line, drawn at `x`. */
export interface LineKey extends LinePoint {
  keyId: string;
}

/** Dragging a point of a clip's volume line. */
export interface LineDrag {
  down: PointerEvent;
  /** The box the line is drawn in: its height is the whole level range. */
  area: HTMLElement;
  /** Where the point is when the drag starts. */
  from: LinePoint;
  /** The clip's width in px: a point stays inside it. */
  width: number;
  /** Every move, with the point's new place. */
  onMove(point: LinePoint): void;
  /** The release, with the last place; null when the pointer never moved, or Escape. */
  onEnd(point: LinePoint | null): void;
}

/** What a finished stroke needs to be written. */
export interface StrokeTarget {
  bus: CommandBus;
  state: ProjectState;
  /** A track, or "master" (always in front). */
  target: LineTarget;
  /** The track's line is in front: the stroke writes it; otherwise the clip under its start. */
  inFront: boolean;
  /** The track line's box on screen; its left edge is the timeline's start. */
  box: DOMRect;
  /** The timeline's content, where the clips' line boxes are found. */
  content: HTMLElement;
  pxPerSecond: number;
}

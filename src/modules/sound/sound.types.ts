import type { RefObject } from "react";
import type { StoreApi } from "zustand/vanilla";
import type { TrackId } from "@/modules/project";
import type { MonitorState } from "@/modules/preview";

/** What the Sound page shows and how the user listens, per kernel. Never in history. */
export interface SoundViewState {
  /** The track whose strip and header are marked, or null. A track, not clips. */
  selectedTrack: TrackId | null;
  /** Soloed tracks; none means every track sounds. Never in an export. */
  solo: TrackId[];
  /** The mixer takes the whole page (Expand all). */
  expanded: boolean;
  /** Mono, Dim and the speaker volume. Never in an export. */
  monitor: MonitorState;
}

/** The sound module's API, per kernel. */
export interface SoundApi {
  /** The page's view state. Solo and the monitor change through `sound.setSolo` / `sound.setMonitor`. */
  view: StoreApi<SoundViewState>;
  /** Marks a track's strip and header, or none. */
  selectTrack(trackId: TrackId | null): void;
  /** Lets the mixer take the whole page, or gives the timeline its place back. */
  setExpanded(expanded: boolean): void;
}

/** What a mixer strip addresses: an audio track, or the master. */
export type MixTarget = TrackId | "master";

/** The loudest level seen lately, held for a while so the eye can catch it. */
export interface PeakHold {
  /** dBFS. */
  db: number;
  /** When it was reached, in ms (`performance.now()`). */
  at: number;
}

/** One side of one meter, registered with the meter loop. */
export interface MeterSide {
  target: MixTarget;
  side: "left" | "right";
  /** Drawn from the bottom up to the level. */
  bar: HTMLElement;
  /** The peak hold line. */
  hold: HTMLElement;
}

/** A meter side as the loop keeps it: what it last wrote, so it writes only changes. */
export interface MeterEntry extends MeterSide {
  /** 0 to 1; -1 before the first write. */
  height: number;
  holdHeight: number;
  peak: PeakHold | null;
}

/** The one animation-frame loop that feeds every meter on the page. */
export interface MeterLoop {
  /** Starts feeding a meter side. Returns what stops it. */
  register(meter: MeterSide): () => void;
  /** Reads the levels on every frame. */
  start(): void;
  /** Stops reading and empties every meter. */
  stop(): void;
}

/** A drag along a fader or a slider. Values are 0 to 1 along it (bottom to top, left to right). */
export interface FaderDrag {
  down: PointerEvent;
  /** The groove the handle moves in. */
  track: HTMLElement;
  axis: "x" | "y";
  /** Where the handle is when the drag starts. */
  start: number;
  /** The press landed on the handle: it moves by the pointer's travel, not to the pointer. */
  grabbed: boolean;
  /** Every move. */
  onMove(position: number): void;
  /** The release, with the last position; null when the pointer never moved. */
  onEnd(position: number | null): void;
}

/** A value set by dragging along a groove: a fader, the pan, the speaker volume. */
export interface SliderOptions {
  axis: "x" | "y";
  /** The groove. */
  trackRef: RefObject<HTMLElement | null>;
  /** The handle: a press on it moves it by the pointer's travel. */
  handleRef: RefObject<HTMLElement | null>;
  /** Where a value sits along the groove, 0 to 1. */
  toPosition(value: number): number;
  /** The value at a position along the groove. */
  fromPosition(position: number): number;
  /** What a double-click returns to. */
  rest: number;
  /** Writes a value to the DOM (handle, readout); called on every move and after a commit. */
  place(value: number): void;
  /** Every move of a drag: play it live, change nothing yet. Null: stop playing it live. */
  onInput(value: number | null): void;
  /** The release with a new value, or a double-click: send the one command. */
  onCommit(value: number): Promise<void>;
  /** The value the document holds now. */
  read(): number;
}

/** The tabs of the panel under the Sound page's timeline. */
export type SoundPanelTab = "clip" | "loudness";

/** What the Loudness tab tells its history graph. */
export interface LoudnessHistoryHandle {
  /** Adds a short-term reading (LUFS; `-Infinity` before one exists), sampled while playing. */
  push(shortTerm: number): void;
  /** Starts the history over (Reset). */
  clear(): void;
}

/** Colours the loudness graph draws with, read from the theme's tokens. */
export interface GraphColours {
  grid: string;
  line: string;
}

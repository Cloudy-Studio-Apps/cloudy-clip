import type { StoreApi } from "zustand/vanilla";
import type { CommandBus, Micros } from "@/core";
import type { CompositionId, ProjectApi, TrackId } from "@/modules/project";
import type { LoopRange, PreviewApi } from "@/modules/preview";
import type { MediaApi } from "@/modules/media";
import type { WorkspaceApi } from "@/modules/workspace";
import type { SoundViewState } from "./sound.types";

/** Where the webview runs, for what has been checked there. */
export type RecordPlatform = "linux" | "windows" | "macos" | "android";

/** What the record worklet is told: keep samples from now (or not), or hand over the rest and stop. */
export type RecordCommand = { keep: boolean } | { flush: true };

/** The microphone, open and feeding the recorder. */
export interface Capture {
  /** The rate the samples come at: the capture context's own. */
  sampleRate: number;
  /** Starts handing samples over, from the next block. */
  keep(): void;
  /** Hands over the samples still gathered, then closes the microphone and the context. */
  stop(): Promise<void>;
}

/** Where a take's file was started (`sound_record_begin`). */
export interface TakeStarted {
  /** For `sound_record_write`. */
  id: string;
  path: string;
}

/** What a write left on disk (`sound_record_write`). */
export interface TakeWritten {
  /** Null once a take with no samples was finished: its file is deleted. */
  path: string | null;
  samples: number;
}

/** What the recorder is doing. View state, never in history. */
export interface RecorderState {
  /** `starting`: opening the microphone and the file; `stopping`: writing the end and placing it. */
  status: "idle" | "starting" | "recording" | "stopping";
  /**
   * The track the take goes onto. Null while idle, and during a take onto a new Voice track until
   * it's placed (the track is made with the take, in its undo step).
   */
  trackId: TrackId | null;
  /** Where the take starts on the timeline. */
  at: Micros;
}

/** Records the microphone into a WAV beside the project and places it as a clip. One take at a time. */
export interface Recorder {
  state: StoreApi<RecorderState>;
  /**
   * Opens the microphone, starts playback and records onto `trackId`, or with `null` onto a new
   * Voice track at the bottom of the open composition (made when the take is placed, then armed).
   * Tells the user when it can't.
   */
  start(trackId: TrackId | null): Promise<void>;
  /**
   * Stops the take and places it (`sound.placeRecording`), or tells the user why not, naming the
   * file. While a stop is under way, returns that one, so a caller can wait for the placement.
   * `pause: false` leaves playback running (a play the user asked for ended the take).
   */
  stop(options?: { pause?: boolean }): Promise<void>;
  /** Arms a track (or none), unless a take is under way. */
  arm(trackId: TrackId | null): void;
  /** The latest input peak in dBFS, `-Infinity` when not recording. Read per frame. */
  level(): number;
  /** How long the take is so far. Read per frame. */
  length(): Micros;
}

/** What the recorder needs. */
export interface RecorderDeps {
  bus: CommandBus;
  preview: PreviewApi;
  project: ProjectApi;
  media: MediaApi;
  workspace: WorkspaceApi;
  /** The Sound page's view: `armed` lives there. */
  view: StoreApi<SoundViewState>;
}

/** A take as the recorder keeps it. */
export interface LiveTake {
  /** Null: onto a new Voice track, made when the take is placed. */
  trackId: TrackId | null;
  at: Micros;
  /** Samples are kept (after playback started) until the take stops. */
  keeping: boolean;
  /** Stop was asked for. While still starting, `start` closes the take itself. */
  ending: boolean;
  /** The stop under way: finishing the file and placing it. */
  finishing: Promise<void> | null;
  /** The composition recorded in. */
  compositionId: CompositionId;
  /** The loop set when the take started: off while it records, set again after. */
  loop: LoopRange | null;
  /** Lets audio scrub sound again (silenced while the microphone is open). */
  releaseScrub: () => void;
  capture: Capture | null;
  file: TakeStarted | null;
  rate: number;
  /** Samples not sent yet. */
  chunks: Int16Array[];
  chunked: number;
  /** Samples kept, sent or not. */
  samples: number;
  /** The latest input peak, dBFS. */
  level: number;
  /** The writes, one after another. */
  writes: Promise<void>;
  /** The last answer from the native side. */
  written: TakeWritten | null;
  /** The first write that failed. */
  failure: unknown;
}

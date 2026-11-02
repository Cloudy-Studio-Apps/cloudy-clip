import type { StoreApi } from "zustand";
import type { ActorId, CommandContext, Micros } from "@/core";
import type { Clip, ClipId, KeyEase, KeyTrack, KeyValue, Track } from "@/modules/project";

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
}

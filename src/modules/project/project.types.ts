import type { Micros, PatchableStore } from "@/core";

export type MediaId = string;
export type TrackId = string;
export type ClipId = string;

/** What a file contains. Decided from its extension at import. */
export type MediaKind = "video" | "audio";

/** A file the user imported. The file itself stays where it is; only its path is kept. */
export interface MediaAsset {
  id: MediaId;
  name: string;
  path: string;
  kind: MediaKind;
  /** Size in bytes. */
  size: number;
}

/** Kind of track. Video tracks hold video clips (with their audio); audio tracks hold audio. */
export type TrackKind = "video" | "audio";

/** A horizontal lane on the timeline. Clips on one track never overlap. */
export interface Track {
  id: TrackId;
  kind: TrackKind;
  name: string;
  /** Clips on this track, sorted by `start`. */
  clipIds: ClipId[];
  /** Silences every clip on the track. */
  muted: boolean;
  /** Hides the track's picture from the preview (video tracks). */
  hidden: boolean;
}

/** A piece of a media file placed on the timeline. */
export interface Clip {
  id: ClipId;
  trackId: TrackId;
  mediaId: MediaId;
  /** Position on the timeline. */
  start: Micros;
  /** Where in the source file the clip begins. */
  sourceIn: Micros;
  /** Length on the timeline (and in the source; no speed changes in v1). */
  duration: Micros;
  /** Where the picture sits in the frame (video clips). Missing means `IDENTITY_TRANSFORM`. */
  transform?: ClipTransform;
}

/**
 * Placement of a clip's picture in the output frame. The picture is first fitted (contained) in
 * the frame and centered; then scaled, rotated about its center, and moved.
 */
export interface ClipTransform {
  /** Horizontal offset of the picture's center from the frame's center, in output pixels. */
  x: number;
  /** Vertical offset (down is positive), in output pixels. */
  y: number;
  /** Size relative to "fit": 1 fits the frame, 2 is twice as big. */
  scale: number;
  /** Clockwise rotation, in degrees (-180, 180]. */
  rotation: number;
}

/** Where a clip's picture lands in the output frame, in output pixels. */
export interface ClipPlacement {
  /** Center of the picture. */
  cx: number;
  cy: number;
  /** Size before rotation. */
  width: number;
  height: number;
  /** Clockwise, in degrees. */
  rotation: number;
}

/** Pixel size of a picture. */
export interface PictureSize {
  width: number;
  height: number;
}

/** Output canvas of the project. */
export interface ProjectFormat {
  width: number;
  height: number;
  fps: number;
}

/** Named output formats offered in the UI and to agents. */
export type FormatPreset = "9:16" | "16:9" | "1:1";

/**
 * The project document: everything that is part of the user's work. Changed only through
 * commands, so every change is undoable and visible to agents.
 */
export interface ProjectState {
  format: ProjectFormat;
  media: Record<MediaId, MediaAsset>;
  /** Import order. */
  mediaOrder: MediaId[];
  tracks: Record<TrackId, Track>;
  /**
   * Track order as shown, top to bottom. Video tracks higher in the list are drawn on top of
   * lower ones.
   */
  trackOrder: TrackId[];
  clips: Record<ClipId, Clip>;
}

/** The project module's API for one kernel. */
export interface ProjectApi {
  /**
   * The project document. Read freely (`getState`, `useStore(store.api, selector)`); change it
   * only through commands (`ctx.mutate`), so every change is undoable.
   */
  readonly store: PatchableStore<ProjectState>;
}

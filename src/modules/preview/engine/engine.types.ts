import type { ElementApi } from "@/modules/element";
import type { MixCanvases } from "./engine.mix";
import type { FontRequest } from "@/modules/fonts";
import type { JunctionApi } from "@/modules/junction";
import type { MediaApi } from "@/modules/media";
import type { Micros } from "@/core";
import type {
  Clip,
  Composition,
  MediaId,
  ProjectFormat,
  ProjectState,
  Track,
} from "@/modules/project";

/** One pooled media element and what it is currently showing. */
export interface Slot {
  element: HTMLMediaElement;
  kind: "video" | "audio";
  mediaId: MediaId | null;
  /** URL currently loaded. Changes when a file gets its proxy, which forces a reload. */
  url: string | null;
  /** Path of the clip it plays, placements included (see `ResolvedClip`). */
  path: string | null;
  /** Target of the seek in flight, to avoid re-issuing it every frame. */
  seekTarget: number | null;
  /** `performance.now()` of the last seek. */
  lastSeekAt: number;
  /** Seconds the last seek took, so the next one can aim ahead of the moving clock. */
  seekCost: number;
  /** Counts seeks and loads, so a wait for an older one's frame can tell it is outdated. */
  seeks: number;
  /**
   * Whether the frame for the current position has actually been decoded. WebKit fires
   * `seeked` before that, so drawing at `seeked` can paint black.
   */
  presented: boolean;
}

/** A decoded picture and its size, ready to draw. */
export interface CachedPicture {
  source: CanvasImageSource;
  width: number;
  height: number;
}

/** What the HTML engine needs from the app. */
export interface EngineOptions {
  /** URL that streams a media item. */
  mediaUrl(id: MediaId): string;
  /** URLs of an image's picture at a moment of its clip, then those up to `ahead` later. */
  imageFrames: MediaApi["imageFrames"];
  /**
   * Whether a font face can be drawn now; when not, it starts loading and the engine draws text
   * in Inter (the caller redraws when it arrives).
   */
  ensureFont(request: FontRequest): boolean;
  /** The kinds of clip: how each one is drawn and its values. */
  elements: Pick<ElementApi, "get" | "resolve">;
  /** The kinds of junction: how two overlapping clips of a track are mixed, and their values. */
  junctions: Pick<JunctionApi, "get" | "resolve">;
  /** Called when a frame becomes available while paused (e.g. a seek finished). */
  onFrameReady(): void;
  /** Only pictures matter (offscreen capture): sound clips get no element at all. */
  pictureOnly?: boolean;
}

/** A track's clips under the playhead, in start order (two during a junction's overlap). */
export interface ActiveTrack {
  track: Track;
  clips: Clip[];
}

/** A clip under the playhead. */
export interface ResolvedClip {
  clip: Clip;
  /** Placement ids down to this clip, joined by "/". Keys elements and canvases. */
  path: string;
  /** The clock of the composition it sits in. */
  time: Micros;
  /** What it shows, when it plays a composition. */
  inner?: ResolvedFrame;
}

/** A track's clips under the playhead. */
export interface ResolvedTrack {
  track: Track;
  clips: ResolvedClip[];
}

/** A clip starting soon, at any depth. */
export interface UpcomingClip {
  path: string;
  clip: Clip;
  track: Track;
  /** The clock of the composition it sits in, once it shows. */
  time: Micros;
}

/** A composition at a time, placements included. */
export interface ResolvedFrame {
  composition: Composition;
  time: Micros;
  /** Top to bottom. */
  tracks: ResolvedTrack[];
  upcoming: UpcomingClip[];
}

/** How a frame is resolved. */
export interface FrameOptions {
  /** Leave sound out (offscreen capture). */
  pictureOnly: boolean;
  /** How far ahead a clip counts as upcoming. */
  preloadAhead: Micros;
}

/** One video track to draw at `time`. */
export interface TrackFrame extends ActiveTrack {
  project: ProjectState;
  /** Format of the composition being drawn. */
  format: ProjectFormat;
  time: Micros;
}

/** Draws one clip onto `target` at its placement (a media frame or the element's own `draw`). */
export type ClipDrawer = (target: CanvasRenderingContext2D, clip: Clip) => void;

/** One placement's offscreen picture, and the canvases for the transitions inside it. */
export interface NestedCanvas {
  ctx: CanvasRenderingContext2D;
  mix: MixCanvases;
}

/** What a placement lands on: a canvas, its format, and its pixels per output pixel. */
export interface PlacementTarget {
  on: CanvasRenderingContext2D;
  format: ProjectFormat;
  kx: number;
  ky: number;
}

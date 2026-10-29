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

/**
 * Kind of track. Video tracks hold pictures only; audio tracks hold sound (from audio files or
 * the sound of video files).
 */
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

/** What every clip on the timeline has, whatever its kind. */
export interface ClipBase {
  id: ClipId;
  trackId: TrackId;
  /** Position on the timeline. */
  start: Micros;
  /** Where in the source file the clip begins. */
  sourceIn: Micros;
  /** Length on the timeline (and in the source; no speed changes in v1). */
  duration: Micros;
  /** Where the picture sits in the frame (video clips). Missing means `IDENTITY_TRANSFORM`. */
  transform?: ClipTransform;
  /**
   * Clips sharing a `linkId` are linked (a video's picture and its sound): they are selected,
   * moved, trimmed, split and deleted together until unlinked. Missing means unlinked.
   */
  linkId?: string;
}

/** A piece of a media file placed on the timeline. `kind` is missing on older clips. */
export interface MediaClip extends ClipBase {
  kind?: "media";
  mediaId: MediaId;
}

/**
 * Text drawn over the video, on a video track. It has no source file, so it can be any length
 * (`sourceIn` stays 0). Without `style` it is drawn in the default style (`defaultTextStyle`).
 */
export interface TextClip extends ClipBase {
  kind: "text";
  /** The words shown. */
  text: string;
  /** How the words look; missing means `defaultTextStyle(format)`. */
  style?: TextStyle;
}

/** A clip on the timeline: a piece of media or a text. */
export type Clip = MediaClip | TextClip;

/** Weight of a font, as CSS numbers. */
export type FontWeight = "100" | "200" | "300" | "400" | "500" | "600" | "700" | "800" | "900";

/** Where a font comes from: shipped with the app, installed on the system, or Google Fonts. */
export type FontSource = "bundled" | "installed" | "google";

/** A font family and where to get it. */
export interface TextFontRef {
  family: string;
  source: FontSource;
}

/** Horizontal alignment of the lines inside the text's box. */
export type TextAlign = "left" | "center" | "right";

/** Color of the letters (`#rrggbb`) and its opacity (0-1). */
export interface TextFill {
  color: string;
  opacity: number;
}

/** Stroke around the letters; `width` in output pixels. */
export interface TextOutline {
  enabled: boolean;
  color: string;
  width: number;
}

/** Box behind the text; `padding` and `radius` in output pixels. */
export interface TextBackground {
  enabled: boolean;
  color: string;
  opacity: number;
  padding: number;
  radius: number;
}

/** Shadow of the letters; `blur` and `distance` in output pixels, `angle` in degrees (90 = down). */
export interface TextShadow {
  enabled: boolean;
  color: string;
  opacity: number;
  blur: number;
  distance: number;
  angle: number;
}

/** Everything that decides how a text looks. Sizes are output pixels. */
export interface TextStyle {
  font: TextFontRef;
  /** Font size in output pixels. */
  size: number;
  weight: FontWeight;
  italic: boolean;
  /** Extra space between letters, in output pixels. */
  letterSpacing: number;
  /** Line height in font sizes. */
  lineHeight: number;
  align: TextAlign;
  uppercase: boolean;
  fill: TextFill;
  outline: TextOutline;
  background: TextBackground;
  shadow: TextShadow;
}

/** A partial style: top-level fields, and nested groups may be partial too (one level deep). */
export type TextStylePatch = {
  [K in keyof TextStyle]?: TextStyle[K] extends object ? Partial<TextStyle[K]> : TextStyle[K];
};

/** One laid-out line. `x` is its left edge and `y` its middle, both from the box center. */
export interface TextLine {
  text: string;
  x: number;
  y: number;
  width: number;
}

/** A text laid out: its box, its lines, and the CSS font and line height used. */
export interface TextLayout {
  box: PictureSize;
  lines: TextLine[];
  font: string;
  lineHeight: number;
}

/** Width of `text` drawn in the CSS `font` with `letterSpacing` pixels between letters (canvas `measureText`, faked in tests). */
export type TextMeasure = (text: string, font: string, letterSpacing: number) => number;

/** The part of a 2D canvas context `canvasTextMeasure` uses; `letterSpacing` is missing in some webviews. */
export interface TextMeasureContext {
  font: string;
  letterSpacing?: string;
  measureText(text: string): { width: number };
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

/**
 * How a clip's picture is sized before its transform: media pictures are fitted (contained) in
 * the frame; text keeps its natural size in output pixels.
 */
export type ClipFit = "contain" | "none";

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

/**
 * Values of the shared property groups (see the element module's `sharedGroups`), each stored on
 * the clip under its own key. A module that owns a shared group extends this interface.
 */
export interface SharedGroupValues {
  transform: ClipTransform;
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

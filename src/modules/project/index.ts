/**
 * Project module: the document (format, media, tracks, clips) and its selectors.
 * Other modules read it here and change it through their own commands.
 * @module project
 */
export { setFormat } from "./project.commands";
export { FORMAT_PRESETS, createEmptyProject } from "./project.store";
export {
  clipEnd,
  formatPreset,
  isMediaInUse,
  orderedTracks,
  projectDuration,
  trackClips,
} from "./project.selectors";
export {
  IDENTITY_TRANSFORM,
  clipFit,
  clipPlacement,
  clipTransform,
  normalizeRotation,
} from "./project.geometry";
export {
  DEFAULT_TEXT,
  bundledCssFamily,
  canvasTextMeasure,
  cssFontFamily,
  defaultTextStyle,
  displayText,
  isTextClip,
  mergeTextStyle,
  textBox,
  textFont,
  textLayout,
  textPadding,
  textStyleOf,
} from "./project.text";
export type {
  Clip,
  ClipBase,
  ClipFit,
  ClipId,
  ClipPlacement,
  ClipTransform,
  PictureSize,
  FormatPreset,
  MediaAsset,
  MediaClip,
  MediaId,
  MediaKind,
  ProjectApi,
  ProjectFormat,
  ProjectState,
  FontSource,
  FontWeight,
  TextAlign,
  TextBackground,
  TextClip,
  TextFill,
  TextFontRef,
  TextLayout,
  TextLine,
  TextMeasure,
  TextMeasureContext,
  TextOutline,
  TextShadow,
  TextStyle,
  TextStylePatch,
  Track,
  TrackId,
  TrackKind,
} from "./project.types";

/** Module definition, loaded by the app shell. */
export { createProjectModule, projectModule } from "./project.module";
/** Handle for `require(projectRef)` / `useModule(projectRef)`. */
export { projectRef } from "./project.ref";

/**
 * Media module: importing files, reading their metadata, and the media library panel.
 * @module media
 */
export { importMedia, removeMedia } from "./media.commands";
export { MEDIA_DRAG_END, MEDIA_DRAG_MOVE, MEDIA_DROP } from "./media.drag";
export { createFakeMediaModule } from "./media.testing";
export type {
  ImportResult,
  MediaApi,
  MediaDragDetail,
  MediaProbe,
  ProbeStatus,
  ProxyInfo,
  ProxyState,
} from "./media.types";

/** Module definition, loaded by the app shell. */
export { mediaModule } from "./media.module";
/** Handle for `require(mediaRef)` / `useModule(mediaRef)`. */
export { mediaRef } from "./media.ref";

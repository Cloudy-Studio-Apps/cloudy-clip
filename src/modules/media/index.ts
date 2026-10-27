/**
 * Media module: importing files, reading their metadata, and the media library panel.
 * @module media
 */
export { importMedia, removeMedia } from "./media.commands";
export { MEDIA_DRAG_END, MEDIA_DRAG_MOVE, MEDIA_DROP } from "./media.drag";
export { mediaUrl } from "./media.service";
export { getProbe, mediaProbeStore, waitForProbe } from "./media.store";
export type {
  ImportResult,
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

/**
 * Media module: importing files, reading their metadata, and the media library panel.
 * @module media
 */
export { mediaHasAudio } from "./media.audio";
export { importMedia, relinkMedia, removeMedia } from "./media.commands";
export { createBin, deleteBin, moveToBin, renameBin } from "./media.bin.commands";
/** Asks where a missing file went and points the media at it. */
export { useLocateMedia } from "./ui";
export { MEDIA_DRAG_END, MEDIA_DRAG_MOVE, MEDIA_DROP, startMediaDrag } from "./media.drag";
export { createFakeMediaModule } from "./media.testing";
/** Sections of the Library, above the files; contribute with `ctx.contribute(librarySections, …)`. */
export { librarySections } from "./media.points";
export type {
  ImageAnimation,
  ImportResult,
  MediaApi,
  LibraryItem,
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
/** The Media page's id, for `showPage`. */
export { MEDIA_PAGE } from "./media.ref";

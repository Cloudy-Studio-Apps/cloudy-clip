/**
 * Media module: importing files, reading their metadata, and the media library panel.
 * @module media
 */
export { mediaHasAudio } from "./media.audio";
export { importMedia, relinkMedia, removeMedia, revealMedia } from "./media.commands";
export { createBin, deleteBin, moveToBin, renameBin } from "./media.bin.commands";
export { renameMedia, setInfo } from "./media.info.commands";
/** Asks where a missing file went and points the media at it. */
export { useLocateMedia } from "./ui";
/** What a file is: name, length, codecs, proxy and where it lives. */
export { FileFactsSection } from "./ui";
/** What you note about a file, editable; shared by all its clips. */
export { MetadataSection } from "./ui";
export { MEDIA_DRAG_END, MEDIA_DRAG_MOVE, MEDIA_DROP, startMediaDrag } from "./media.drag";
export { createFakeMediaModule } from "./media.testing";
/** Sections of the Library, above the files; contribute with `ctx.contribute(librarySections, …)`. */
export { librarySections } from "./media.points";
/** Kinds of item the library lists besides files; contribute with `ctx.contribute(libraryKinds, …)`. */
export { libraryKinds } from "./media.points";
export type {
  DenoiseJob,
  DenoiseJobs,
  DenoiseRequest,
  DenoiseSettings,
  DiskInfo,
  FileFacts,
  ImageAnimation,
  ImportResult,
  MediaApi,
  LibraryEntry,
  LibraryItem,
  LibraryPlace,
  LibraryRow,
  LibraryView,
  LibraryKind,
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

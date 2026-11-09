import { definePoint } from "@/core";
import type { FrameFilter, PictureFilter, PreviewOverlay } from "./preview.types";

/** Layers over the preview frame (selection boxes, guides). The preview panel reads them. */
export const previewOverlays = definePoint<PreviewOverlay>("preview.overlays", {
  keyOf: (overlay) => overlay.id,
});

/**
 * GPU passes on a clip's own picture before it lands (a clip's color grade), keyed by id. Every
 * engine reads them: the live preview, captures and export.
 */
export const pictureFilters = definePoint<PictureFilter>("preview.pictureFilters", {
  keyOf: (filter) => filter.id,
});

/**
 * GPU passes on a composition's composed frame (a whole-timeline grade), at the top level and in
 * each placement, keyed by id. Every engine reads them.
 */
export const frameFilters = definePoint<FrameFilter>("preview.frameFilters", {
  keyOf: (filter) => filter.id,
});

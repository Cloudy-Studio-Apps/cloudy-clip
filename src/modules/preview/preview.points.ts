import { definePoint } from "@/core";
import type { PreviewOverlay } from "./preview.types";

/** Layers over the preview frame (selection boxes, guides). The preview panel reads them. */
export const previewOverlays = definePoint<PreviewOverlay>("preview.overlays", {
  keyOf: (overlay) => overlay.id,
});

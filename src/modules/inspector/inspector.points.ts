import { definePoint } from "@/core";
import type { InspectorClipSection } from "./inspector.types";

/**
 * Sections of the inspector's clip view (transform, text, …). The inspector reads them, shows
 * those whose `appliesTo` is true sorted by `order`, each in a collapsible section.
 */
export const inspectorSections = definePoint<InspectorClipSection>("inspector.sections", {
  keyOf: (section) => section.id,
});

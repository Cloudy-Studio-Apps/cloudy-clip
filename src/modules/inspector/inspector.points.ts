import { definePoint } from "@/core";
import type { PropertyControl, SectionLayout } from "./inspector.types";

/**
 * Controls that edit a value or run a command in an element's panel, by id (`slider`, `color`,
 * `font-picker`, …). The inspector reads them; an unknown id shows a warning row.
 */
export const propertyControls = definePoint<PropertyControl>("inspector.propertyControls", {
  keyOf: (control) => control.id,
});

/** Ways to draw a whole section of an element's panel, by id (`section`). */
export const sectionLayouts = definePoint<SectionLayout>("inspector.sectionLayouts", {
  keyOf: (layout) => layout.id,
});

import { definePoint } from "@/core";
import type {
  FieldAction,
  InspectorSectionItem,
  InspectorTab,
  PropertyControl,
  SectionLayout,
} from "./inspector.types";

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

/**
 * The tabs of a clip's panel, by id. A tab is available exactly when a section lands in it; the
 * others are greyed out, or left out when `contextual`.
 */
export const inspectorTabs = definePoint<InspectorTab>("inspector.tabs", {
  keyOf: (tab) => tab.id,
});

/**
 * Sections of a clip's panel that aren't properties of its element (Timing, Sound, a plugin's
 * Stabilization), by id. Each is drawn in the standard band unless it is `bare`.
 */
export const inspectorSections = definePoint<InspectorSectionItem>("inspector.sections", {
  keyOf: (section) => section.id,
});

/** What sits at the end of a field's row, by id: reset now, keyframes later. */
export const fieldActions = definePoint<FieldAction>("inspector.fieldActions", {
  keyOf: (action) => action.id,
});

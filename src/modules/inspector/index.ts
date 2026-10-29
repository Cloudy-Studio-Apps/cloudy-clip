/**
 * Inspector module: the right column with details of the project or the selected clips. A clip's
 * panel is generated from its element; modules add controls and section layouts.
 * @module inspector
 */
export type {
  CommandControlProps,
  FieldControlProps,
  InspectorApi,
  PropertyControl,
  PropsLive,
  RecentColors,
  SectionLayout,
  SectionLayoutProps,
} from "./inspector.types";

/** Controls (by id) and section layouts (by id) an element's panel can use. */
export { propertyControls, sectionLayouts } from "./inspector.points";
/** Live editing of a clip's values: preview while dragging, one `element.setProps` on release. */
export { usePropsLive } from "./ui/props.live.hook";
/** A label on the left and a control filling the row, for custom controls. */
export { FieldRow } from "./ui/controls/FieldRow";
/** Builds a patch that sets a value at a dotted path. */
export { pathPatch } from "./logic/paths";
/** Module definition, loaded by the app shell. */
export { inspectorModule } from "./inspector.module";
/** Handle for `require(inspectorRef)` / `useModule(inspectorRef)`. */
export { inspectorRef } from "./inspector.ref";

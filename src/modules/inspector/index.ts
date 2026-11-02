/**
 * Inspector module: the right column with details of the project or the selected clips. A clip's
 * panel is generated from its element; modules add controls and section layouts.
 * @module inspector
 */
export type {
  CommandControlProps,
  FieldAction,
  FieldActionProps,
  FieldControlProps,
  InspectorApi,
  InspectorContext,
  InspectorMember,
  InspectorSectionItem,
  InspectorTab,
  InspectorView,
  InspectorViewState,
  PropertyControl,
  PropsLive,
  RecentColors,
  SectionLayout,
  SectionLayoutProps,
  SectionReset,
} from "./inspector.types";

/**
 * What a panel is made of: controls and section layouts an element can use, the tabs, sections of
 * a clip that aren't its element's properties, and the actions at the end of a field's row.
 */
export {
  fieldActions,
  inspectorSections,
  inspectorTabs,
  propertyControls,
  sectionLayouts,
} from "./inspector.points";
/** Live editing of a clip's values: preview while dragging, one `element.setProps` on release. */
export { usePropsLive } from "./ui/props.live.hook";
/** A label on the left and a control filling the row, for custom controls. */
export { FieldRow } from "./ui/controls/FieldRow";
/** A collapsible group of fields, for custom section layouts. */
export { InspectorSection } from "./ui/InspectorSection";
/** Builds a patch that sets a value at a dotted path. */
export { pathPatch } from "./logic/paths";
/** Module definition, loaded by the app shell. */
export { inspectorModule } from "./inspector.module";
/** Handle for `require(inspectorRef)` / `useModule(inspectorRef)`. */
export { inspectorRef } from "./inspector.ref";

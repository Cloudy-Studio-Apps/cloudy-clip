/**
 * Element module: kinds of clip declared once (properties, layout, picture, timeline look,
 * creation) and the generic commands that change their values.
 * @module element
 */
/** Changes the values of clips of one kind (partial patch, groups one level deep). */
export { setProps } from "./element.commands";
/** Puts values of clips back to their defaults. */
export { resetProps } from "./element.commands";
/** Points: kinds of clip, shared property groups, custom value types. */
export { elements, propTypes, sharedGroups } from "./element.points";
/** Declares an element, a shared group or a custom prop type. */
export { defineElement, definePropType, defineSharedGroup } from "./logic/define";
/** Builders of declared properties, and the control a property uses by default. */
export { defaultControl, prop } from "./logic/props";
/** The Zod schema of a patch of values. */
export { patchSchema } from "./logic/schema";
/** Merging, resolving and minimizing values; reading a dotted path. */
export { deepEqual, getPath, mergeProps, minimizeProps, resolveProps } from "./logic/values";
export type {
  AnyElement,
  CreateEntry,
  CustomProps,
  CustomValues,
  DefinedElement,
  DisplayEnv,
  DrawEnv,
  ElementApi,
  ElementDefinition,
  ElementDisplay,
  LayoutItem,
  LayoutSection,
  NormalizeEnv,
  PictureDefinition,
  PropertyTree,
  PropsOf,
  PropsPatch,
  PropSpec,
  PropType,
  PropUi,
  ResolvedElement,
  SharedGroup,
} from "./element.types";

/** Module definition, loaded by the app shell. */
export { elementModule } from "./element.module";
/** Handle for `require(elementRef)` / `useModule(elementRef)`. */
export { elementRef } from "./element.ref";

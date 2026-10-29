import type { ProjectFormat } from "@/modules/project";
import type {
  DefinedElement,
  ElementDefinition,
  PropertyTree,
  PropsOf,
  PropType,
  SharedGroup,
} from "../element.types";
import { resolveProps } from "./values";

/**
 * Declares an element. Its values are typed from `properties`; `resolve(clip, format)` reads a
 * clip's values (stored props over the defaults).
 */
export function defineElement<
  T extends PropertyTree,
  P extends Record<string, unknown> = PropsOf<T>,
>(definition: ElementDefinition<P> & { properties: T }): DefinedElement<P> {
  return {
    ...definition,
    resolve(clip: { props?: Record<string, unknown> }, format: ProjectFormat): P {
      return resolveProps(clip.props ?? {}, definition.defaults(format));
    },
  };
}

/** Declares a shared property group (transform). */
export function defineSharedGroup(group: SharedGroup): SharedGroup {
  return group;
}

/** Declares a custom prop type (a font). */
export function definePropType(type: PropType): PropType {
  return type;
}

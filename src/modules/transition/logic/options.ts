import { defaultControl, labelOf, type PropType } from "@/modules/element";
import type { PropertyTree } from "@/modules/element";
import type { OptionField } from "../transition.types";

/** The preset's options that are shown, in declaration order, each with the control that edits it. */
export function optionFields(
  properties: PropertyTree,
  propType: (name: string) => PropType | undefined,
): OptionField[] {
  return Object.entries(properties)
    .filter(([, spec]) => !spec.hidden)
    .map(([name, spec]) => ({
      name,
      spec,
      label: spec.label ?? labelOf(name),
      control: defaultControl(spec, spec.type ? propType(spec.type) : undefined),
    }));
}

/**
 * The `options` patch for a change to some of the preset's options: the stored options, then the
 * changes input so far, then this patch. Always the whole object, so it replaces the stored one.
 */
export function optionsPatch(
  stored: Record<string, unknown>,
  ...patches: ReadonlyArray<Record<string, unknown>>
): { options: Record<string, unknown> } {
  return { options: Object.assign({}, stored, ...patches) as Record<string, unknown> };
}

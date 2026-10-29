import { secondsToMicros } from "@/core";
import type { JunctionEdit } from "../inspector.types";
import { indexFields, type LayoutSource, type PropertyTree } from "@/modules/element";

/** The `junction.set` input for one junction: the patch as is, the duration in integer µs. */
export function junctionSetInput(
  id: string,
  edit: JunctionEdit,
): { junctionIds: string[]; patch?: Record<string, unknown>; duration?: number } {
  return {
    junctionIds: [id],
    ...(edit.patch !== undefined && { patch: edit.patch }),
    ...(edit.seconds !== undefined && { duration: secondsToMicros(edit.seconds) }),
  };
}

/** A kind's properties as something `resolveLayout` can draw (no shared groups). */
export function junctionLayoutSource(kind: string, properties: PropertyTree): LayoutSource {
  const fields = new Map();
  indexFields(properties, "", fields);
  return { definition: { kind, properties }, groups: [], fields };
}

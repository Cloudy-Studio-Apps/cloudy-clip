import { indexFields, type LayoutSource, type PropertyTree } from "@/modules/element";

/** A kind's properties as something `resolveLayout` can draw (no shared groups). */
export function layoutSourceOf(kind: string, properties: PropertyTree): LayoutSource {
  const fields = new Map();
  indexFields(properties, "", fields);
  return { definition: { kind, properties }, groups: [], fields };
}

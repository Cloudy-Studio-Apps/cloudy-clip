import {
  deepEqual,
  getPath,
  type PropSpec,
  type ResolvedItem,
  type ResolvedSection,
} from "@/modules/element";

/** A field's path and, for a color with an opacity, the sibling its control edits along with it. */
function fieldPaths(path: string, spec: PropSpec | undefined): string[] {
  if (!spec?.opacity) return [path];
  return [path, path.slice(0, path.lastIndexOf(".") + 1) + spec.opacity];
}

/** The paths an item edits (every field of a row or sub-section). Commands have none. */
export function itemPaths(item: ResolvedItem, fields: ReadonlyMap<string, PropSpec>): string[] {
  if (item.type === "field") return fieldPaths(item.path, fields.get(item.path));
  if (item.type === "command") return [];
  return item.items.flatMap((inner) => itemPaths(inner, fields));
}

/** The specs of a row's fields, so actions can tell whether they apply to it. */
export function rowSpecs(
  row: Extract<ResolvedItem, { type: "row" }>,
  fields: ReadonlyMap<string, PropSpec>,
): PropSpec[] {
  return row.items.flatMap((item) => (item.type === "field" ? (fields.get(item.path) ?? []) : []));
}

/**
 * The paths of a section. Its header's on/off value isn't one, and neither are words: a reset
 * leaves the user's text alone.
 */
export function sectionPaths(
  section: ResolvedSection,
  fields: ReadonlyMap<string, PropSpec>,
): string[] {
  return section.items
    .flatMap((item) => itemPaths(item, fields))
    .filter((path) => fields.get(path)?.multiline !== true);
}

/** Whether any of `paths` differs from its default. */
export function differs(
  paths: readonly string[],
  values: Record<string, unknown>,
  defaults: Record<string, unknown>,
): boolean {
  return paths.some((path) => !deepEqual(getPath(values, path), getPath(defaults, path)));
}

import type { PropSpec } from "../element.types";

/** Every field of a tree by path, groups first then their fields. */
export function indexFields(
  tree: Readonly<Record<string, PropSpec>>,
  prefix: string,
  out: Map<string, PropSpec>,
) {
  for (const [name, spec] of Object.entries(tree)) {
    if (name.includes(".")) continue;
    out.set(prefix + name, spec);
    if (spec.kind === "group") indexFields(spec.fields ?? {}, `${prefix}${name}.`, out);
  }
}

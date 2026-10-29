import { z } from "zod";
import type { PropertyTree, PropSpec, SchemaEnv } from "../element.types";

/** The Zod schema of one value. */
function valueSchema(spec: PropSpec, env: SchemaEnv): z.ZodType {
  switch (spec.kind) {
    case "string": {
      let checked = z.string();
      if (spec.min !== undefined)
        checked = checked.min(spec.min, `At least ${spec.min} characters`);
      if (spec.max !== undefined) checked = checked.max(spec.max);
      return spec.trim
        ? z
            .string()
            .transform((s) => s.trim())
            .pipe(checked)
        : checked;
    }
    case "number": {
      let checked = z.number();
      if (spec.min !== undefined) checked = checked.min(spec.min);
      if (spec.max !== undefined) checked = checked.max(spec.max);
      return checked;
    }
    case "boolean":
      return z.boolean();
    case "color":
      return z
        .string()
        .regex(/^#[0-9a-f]{6}$/i, "Use #rrggbb")
        .transform((value) => value.toLowerCase());
    case "enum":
      return z.enum((spec.values ?? []) as [string, ...string[]]);
    case "group":
      return groupSchema(spec.fields ?? {}, env);
    case "custom":
      return (spec.type && env.propType(spec.type)?.schema(spec.args)) || z.unknown();
  }
}

/** Every field optional, unknown keys refused. */
function groupSchema(tree: PropertyTree, env: SchemaEnv) {
  const shape: Record<string, z.ZodType> = {};
  for (const [name, spec] of Object.entries(tree)) {
    if (name.includes(".")) continue; // an override of a shared field, not a value
    shape[name] = valueSchema(spec, env).optional();
  }
  return z.strictObject(shape);
}

/**
 * The schema of a patch of an element's values: every field optional, groups partial, unknown
 * keys refused; supported shared groups parse under their key (`transform: { x }`).
 */
export function patchSchema(tree: PropertyTree, env: SchemaEnv) {
  const root = groupSchema(tree, env);
  const groups: Record<string, z.ZodType> = {};
  for (const group of env.groups) groups[group.key] = groupSchema(group.tree, env).optional();
  return root.extend(groups);
}

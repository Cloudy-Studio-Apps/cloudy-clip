import type { Logger, PointReader } from "@/core";
import type { Clip, ProjectFormat } from "@/modules/project";
import { elements, propTypes, sharedGroups } from "./element.points";
import type {
  AnyElement,
  ElementApi,
  PropSpec,
  ResolvedElement,
  SharedGroup,
} from "./element.types";
import { groupValue } from "./logic/clip";
import { indexFields } from "./logic/fields";
import { narrowGroup } from "./logic/groups";
import { patchSchema } from "./logic/schema";
import { mergeProps, resolveProps } from "./logic/values";

/**
 * The element registry of one kernel: elements from the points, with their shared groups and
 * schemas worked out once and kept until a point changes.
 */
export function createElementApi(
  points: PointReader,
  log: Logger,
): ElementApi & { dispose(): void } {
  let cache = new Map<string, ResolvedElement>();
  const warned = new Set<string>();
  const warn = (message: string) => {
    if (warned.has(message)) return;
    warned.add(message);
    log.warn(message);
  };
  const unsubscribe = points.subscribe(() => {
    cache = new Map();
  });

  const build = (definition: AnyElement): ResolvedElement => {
    const groups: SharedGroup[] = [];
    for (const [id, how] of Object.entries(definition.supports ?? {})) {
      const group = points.find(sharedGroups, id);
      if (!group) {
        warn(`element "${definition.kind}": shared group "${id}" is not registered`);
        continue;
      }
      groups.push(narrowGroup(group, how, definition.properties, warn, definition.kind));
    }
    const fields = new Map<string, PropSpec>();
    indexFields(definition.properties, "", fields);
    for (const group of groups) indexFields(group.properties, `${group.key}.`, fields);
    for (const [path, spec] of fields) {
      if (spec.kind !== "custom" || (spec.type && points.find(propTypes, spec.type))) continue;
      warn(
        `element "${definition.kind}": value type "${spec.type}" for "${path}" is not registered (is its module loaded?)`,
      );
    }
    const schema = patchSchema(definition.properties, {
      propType: (name) => points.find(propTypes, name),
      groups: groups.map((g) => ({ key: g.key, tree: g.properties })),
    });
    return { definition, groups, fields, schema };
  };

  const get = (kind: string) => {
    const cached = cache.get(kind);
    if (cached) return cached;
    const definition = points.find(elements, kind);
    if (!definition) return undefined;
    const resolved = build(definition);
    cache.set(kind, resolved);
    return resolved;
  };

  return {
    get,
    list: () => points.get(elements).flatMap((e) => get(e.kind) ?? []),
    resolve(clip: Clip, format: ProjectFormat) {
      const resolved = get(clip.kind ?? "media");
      if (!resolved) return {};
      const values: Record<string, unknown> = resolveProps(
        clip.props ?? {},
        resolved.definition.defaults(format),
      );
      for (const group of resolved.groups) {
        values[group.key] = mergeProps(group.defaults(format), groupValue(clip, group.key));
      }
      return values;
    },
    warn,
    dispose: unsubscribe,
  };
}

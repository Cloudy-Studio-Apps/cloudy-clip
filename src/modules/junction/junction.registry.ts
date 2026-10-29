import { Ban } from "lucide-react";
import type { Logger, PointReader } from "@/core";
import { patchSchema, propTypes, resolveProps } from "@/modules/element";
import type { Junction, ProjectFormat } from "@/modules/project";
import { junctionKinds } from "./junction.points";
import type { JunctionApi, JunctionKindDefinition, ResolvedJunctionKind } from "./junction.types";

/**
 * The junction registry of one kernel: kinds from the `junctionKinds` point with their patch
 * schemas worked out once and kept until a point changes.
 */
export function createJunctionApi(
  points: PointReader,
  log: Logger,
): JunctionApi & { dispose(): void } {
  let cache = new Map<string, ResolvedJunctionKind>();
  const warned = new Set<string>();
  const warn = (message: string) => {
    if (warned.has(message)) return;
    warned.add(message);
    log.warn(message);
  };
  const unsubscribe = points.subscribe(() => {
    cache = new Map();
  });

  const build = (definition: JunctionKindDefinition): ResolvedJunctionKind => ({
    definition,
    schema: patchSchema(definition.properties, {
      propType: (name) => points.find(propTypes, name),
      groups: [],
    }),
  });

  const get = (kind: string) => {
    const cached = cache.get(kind);
    if (cached) return cached;
    const definition = points.find(junctionKinds, kind);
    if (!definition) return undefined;
    const resolved = build(definition);
    cache.set(kind, resolved);
    return resolved;
  };

  const resolve = (junction: Junction, format: ProjectFormat) => {
    const resolved = get(junction.kind);
    if (!resolved) return {};
    return resolveProps(junction.props, resolved.definition.defaults(format));
  };

  return {
    get,
    list: () => points.get(junctionKinds).flatMap((k) => get(k.kind) ?? []),
    resolve,
    display(junction, format) {
      const resolved = get(junction.kind);
      if (!resolved) {
        warn(`junction "${junction.id}": kind "${junction.kind}" is not registered`);
        return { label: `${junction.kind} (not available)`, icon: Ban, missing: true };
      }
      const { name, icon, display } = resolved.definition;
      const shown = display?.(resolve(junction, format)) ?? {};
      return { label: shown.label ?? name, icon: shown.icon ?? icon, missing: false };
    },
    warn,
    dispose: unsubscribe,
  };
}

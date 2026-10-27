import type { AnyModuleDefinition } from "./module.types";

/**
 * Orders modules so every module comes after its `requires` and `after` (Kahn's algorithm,
 * keeping input order among ready modules). When possible it also places `uses` first and core
 * modules before features (features may require core modules unlisted); those two preferences
 * give way rather than form a cycle. Modules whose `requires`/`uses` are neither loaded nor
 * loadable are skipped, with a reason. Throws on a `requires`/`after` cycle.
 */
export function orderModules(
  modules: readonly AnyModuleDefinition[],
  loadedIds: ReadonlySet<string>,
): { order: AnyModuleDefinition[]; skipped: Record<string, string> } {
  const byId = new Map(modules.map((m) => [m.ref.id, m]));
  const skipped: Record<string, string> = {};

  // Drop modules with missing dependencies until nothing changes (skips cascade).
  for (let changed = true; changed;) {
    changed = false;
    for (const module of byId.values()) {
      const needed = [...(module.requires ?? []), ...(module.uses ?? [])];
      const missing = needed.find((id) => !loadedIds.has(id) && !byId.has(id));
      if (missing === undefined) continue;
      skipped[module.ref.id] = skipped[missing]
        ? `"${missing}" was skipped`
        : `"${missing}" is not available`;
      byId.delete(module.ref.id);
      changed = true;
    }
  }

  const pending = [...byId.values()];
  const order: AnyModuleDefinition[] = [];
  const placed = new Set<string>();
  const done = (id: string) => placed.has(id) || !byId.has(id);
  const ready = (module: AnyModuleDefinition) =>
    [...(module.requires ?? []), ...(module.after ?? [])].every(done);
  const corePending = () => pending.some((m) => m.tier === "core");
  const preferred = (module: AnyModuleDefinition) =>
    ready(module) && (module.uses ?? []).every(done) && (module.tier === "core" || !corePending());

  while (pending.length > 0) {
    let index = pending.findIndex(preferred);
    if (index === -1) index = pending.findIndex(ready);
    if (index === -1) {
      const ids = pending.map((m) => `"${m.ref.id}"`).join(", ");
      throw new Error(`Module dependency cycle between ${ids}`);
    }
    const [module] = pending.splice(index, 1);
    if (!module) break;
    order.push(module);
    placed.add(module.ref.id);
  }
  return { order, skipped };
}

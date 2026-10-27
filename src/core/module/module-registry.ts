import type { CommandBus } from "../command/command.types";
import { createLogger } from "../errors/logger";
import type { History } from "../history/history.types";
import type { McpRegistry } from "../mcp/mcp.types";
import { orderModules } from "./module-order";
import type {
  AnyModuleDefinition,
  Disposer,
  ModuleContext,
  ModuleSetup,
  ModuleRef,
  ModuleRegistry,
  ModuleStatus,
} from "./module.types";
import type { PointRegistry } from "./points.types";

const log = createLogger("modules");

interface LoadedModule {
  definition: AnyModuleDefinition;
  status: ModuleStatus;
  api: unknown;
  disposers: Disposer[];
}

/** Creates the module registry of one kernel. */
export function createModuleRegistry(deps: {
  bus: CommandBus;
  history: History;
  mcp: McpRegistry;
  points: PointRegistry;
}): ModuleRegistry {
  const loaded = new Map<string, LoadedModule>();

  function dispose(entry: LoadedModule): void {
    for (const disposer of entry.disposers.splice(0).reverse()) {
      try {
        disposer();
      } catch (error) {
        log.error(`Disposing "${entry.definition.ref.id}" failed`, error);
      }
    }
  }

  function apiOf<A>(ref: ModuleRef<A>): A {
    const entry = loaded.get(ref.id);
    if (entry?.status !== "active") throw new Error(`Module "${ref.id}" is not loaded`);
    return entry.api as A;
  }

  function contextFor(module: AnyModuleDefinition, entry: LoadedModule): ModuleContext {
    const id = module.ref.id;
    const declared = new Set([id, ...(module.requires ?? []), ...(module.uses ?? [])]);
    return {
      bus: deps.bus,
      history: deps.history,
      mcp: deps.mcp,
      points: deps.points,
      log: createLogger(id),
      require(ref) {
        const target = loaded.get(ref.id);
        if (ref.id === id) {
          // Requiring itself during setup: its API doesn't exist yet.
          if (entry.status !== "active") throw new Error(`Module "${id}" is still setting up`);
          return entry.api as never;
        }
        if (target?.status !== "active") {
          throw new Error(`Module "${id}" requires "${ref.id}", but "${ref.id}" is not loaded`);
        }
        if (!declared.has(ref.id) && target.definition.tier !== "core") {
          throw new Error(`Module "${id}" may not require "${ref.id}": add it to requires or uses`);
        }
        return apiOf(ref);
      },
      contribute(point, ...items) {
        entry.disposers.push(deps.points.add(point, id, items));
      },
      onDispose(cleanup) {
        entry.disposers.push(cleanup);
      },
    };
  }

  async function loadOne(module: AnyModuleDefinition): Promise<ModuleStatus> {
    const id = module.ref.id;
    if (loaded.has(id)) throw new Error(`Module "${id}" is already loaded`);
    const entry: LoadedModule = {
      definition: module,
      status: "failed",
      api: undefined,
      disposers: [],
    };
    loaded.set(id, entry);

    try {
      for (const command of module.commands ?? []) {
        if (!command.id.startsWith(`${id}.`)) {
          throw new Error(`Command "${command.id}" must be namespaced "${id}.<action>"`);
        }
        entry.disposers.push(deps.bus.register(command));
      }
      for (const tool of module.mcpTools ?? []) {
        if (!tool.name.startsWith(`${id}_`)) {
          throw new Error(`MCP tool "${tool.name}" must be prefixed "${id}_"`);
        }
        entry.disposers.push(deps.mcp.register(tool));
      }
      const result = (await module.setup?.(contextFor(module, entry))) as
        ModuleSetup<unknown> | undefined;
      entry.api = result?.api;
      if (result?.dispose) entry.disposers.push(result.dispose);
      entry.status = "active";
    } catch (error) {
      log.error(`Module "${id}" failed to load`, error);
      dispose(entry);
      entry.status = "failed";
    }
    return entry.status;
  }

  async function loadAll(
    modules: readonly AnyModuleDefinition[],
  ): Promise<Record<string, ModuleStatus>> {
    const active = new Set([...loaded].filter(([, e]) => e.status === "active").map(([id]) => id));
    const { order, skipped } = orderModules(modules, active);
    const statuses: Record<string, ModuleStatus> = {};
    for (const [id, reason] of Object.entries(skipped)) {
      log.warn(`Module "${id}" skipped: ${reason}`);
      statuses[id] = "skipped";
    }
    for (const module of order) {
      // `requires` must be active; `uses` only must not have failed (it may load after this one).
      const broken =
        (module.requires ?? []).find((dep) => loaded.get(dep)?.status !== "active") ??
        (module.uses ?? []).find((dep) => {
          const status = loaded.get(dep)?.status;
          return status === "failed" || status === "skipped";
        });
      if (broken !== undefined) {
        log.warn(`Module "${module.ref.id}" skipped: "${broken}" did not load`);
        loaded.set(module.ref.id, {
          definition: module,
          status: "skipped",
          api: undefined,
          disposers: [],
        });
        statuses[module.ref.id] = "skipped";
        continue;
      }
      statuses[module.ref.id] = await loadOne(module);
    }
    // Report in input order.
    return Object.fromEntries(modules.map((m) => [m.ref.id, statuses[m.ref.id] ?? "skipped"]));
  }

  return {
    loadAll,
    async load(module) {
      const statuses = await loadAll([module]);
      return statuses[module.ref.id] ?? "skipped";
    },
    require: apiOf,
    status: (id) => loaded.get(id)?.status,
    unloadAll() {
      for (const entry of [...loaded.values()].reverse()) dispose(entry);
      loaded.clear();
    },
  };
}

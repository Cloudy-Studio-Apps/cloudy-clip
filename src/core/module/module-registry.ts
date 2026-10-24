import type { CommandBus } from "../command/command.types";
import { createLogger } from "../errors/logger";
import type { History } from "../history/history.types";
import type { McpRegistry } from "../mcp/mcp.types";
import type { Disposer, ModuleDefinition, ModuleRegistry, ModuleStatus } from "./module.types";

const log = createLogger("modules");

interface LoadedModule {
  definition: ModuleDefinition;
  status: ModuleStatus;
  disposers: Disposer[];
}

/** Creates the module registry. */
export function createModuleRegistry(deps: {
  bus: CommandBus;
  history: History;
  mcp: McpRegistry;
}): ModuleRegistry {
  const loaded = new Map<string, LoadedModule>();

  function dispose(entry: LoadedModule): void {
    for (const disposer of entry.disposers.splice(0).reverse()) {
      try {
        disposer();
      } catch (error) {
        log.error(`Disposing "${entry.definition.id}" failed`, error);
      }
    }
  }

  return {
    async load(module) {
      if (loaded.has(module.id)) throw new Error(`Module "${module.id}" is already loaded`);
      const entry: LoadedModule = { definition: module, status: "active", disposers: [] };
      loaded.set(module.id, entry);

      try {
        for (const command of module.commands ?? []) {
          if (!command.id.startsWith(`${module.id}.`)) {
            throw new Error(`Command "${command.id}" must be namespaced "${module.id}.<action>"`);
          }
          entry.disposers.push(deps.bus.register(command));
        }
        for (const tool of module.mcpTools ?? []) {
          if (!tool.name.startsWith(`${module.id}_`)) {
            throw new Error(`MCP tool "${tool.name}" must be prefixed "${module.id}_"`);
          }
          entry.disposers.push(deps.mcp.register(tool));
        }
        const disposer = await module.activate?.({
          bus: deps.bus,
          history: deps.history,
          mcp: deps.mcp,
          log: createLogger(module.id),
        });
        if (typeof disposer === "function") entry.disposers.push(disposer);
      } catch (error) {
        log.error(`Module "${module.id}" failed to load`, error);
        dispose(entry);
        entry.status = "failed";
      }
      return entry.status;
    },
    unloadAll() {
      for (const entry of [...loaded.values()].reverse()) dispose(entry);
      loaded.clear();
    },
    status: (id) => loaded.get(id)?.status,
  };
}

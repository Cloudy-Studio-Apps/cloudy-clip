import { createCommandBus } from "./command/command-bus";
import type { CommandBus } from "./command/command.types";
import { createHistory } from "./history/history";
import { createHistoryModule } from "./history/history.module";
import type { History } from "./history/history.types";
import { createMcpRegistry } from "./mcp/mcp-registry";
import type { McpRegistry } from "./mcp/mcp.types";
import { createModuleRegistry } from "./module/module-registry";
import type { ModuleRegistry } from "./module/module.types";
import { createPointRegistry } from "./module/points";
import type { PointReader } from "./module/points.types";

/** The application kernel: everything modules and plugins plug into. */
export interface Kernel {
  readonly bus: CommandBus;
  readonly history: History;
  readonly mcp: McpRegistry;
  readonly modules: ModuleRegistry;
  /** Every contribution made by loaded modules (panels, keybindings, ...). */
  readonly points: PointReader;
}

/**
 * Creates a kernel and loads the built-in `history` module (undo/redo commands and tools).
 * Each kernel has its own modules, state and services; tests create their own.
 */
export async function createKernel(): Promise<Kernel> {
  const history = createHistory();
  const mcp = createMcpRegistry();
  const points = createPointRegistry();
  // The bus resolves `ctx.require` through the registry, which needs the bus. The closure runs
  // only when a command executes, after `modules` exists.
  const bus = createCommandBus({ history, resolveModule: (ref) => modules.require(ref) });
  const modules = createModuleRegistry({ bus, history, mcp, points });

  await modules.load(createHistoryModule(history));

  return { bus, history, mcp, modules, points };
}

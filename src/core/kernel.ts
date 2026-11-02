import { createCommandBus } from "./command/command.bus";
import { createHistory } from "./history/history";
import { createHistoryModule } from "./history/history.module";
import { createMcpRegistry } from "./mcp/mcp.registry";
import { createModuleRegistry } from "./module/module.registry";
import { createPointRegistry } from "./module/points";
import { pagesModule } from "./shell/shell.pages";
import type { Kernel } from "./kernel.types";

/**
 * Creates a kernel and loads the built-in modules: `history` (undo/redo commands and tools) and
 * `pages` (which page shows).
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
  await modules.load(pagesModule);

  return { bus, history, mcp, modules, points };
}

import { z } from "zod";
import { createCommandBus } from "./command/command-bus";
import type { CommandBus } from "./command/command.types";
import { createHistory } from "./history/history";
import { createHistoryCommands } from "./history/history.commands";
import type { History } from "./history/history.types";
import { commandTool, defineMcpTool, textResult } from "./mcp/define-mcp-tool";
import { createMcpRegistry } from "./mcp/mcp-registry";
import type { McpRegistry } from "./mcp/mcp.types";
import { createModuleRegistry } from "./module/module-registry";
import type { ModuleDefinition, ModuleRegistry } from "./module/module.types";

/** The application kernel: everything modules and plugins plug into. */
export interface Kernel {
  readonly bus: CommandBus;
  readonly history: History;
  readonly mcp: McpRegistry;
  readonly modules: ModuleRegistry;
}

/**
 * Creates a kernel and loads the built-in `history` module (undo/redo commands and tools).
 * One kernel per app; tests create their own.
 */
export async function createKernel(): Promise<Kernel> {
  const history = createHistory();
  const bus = createCommandBus({ history });
  const mcp = createMcpRegistry();
  const modules = createModuleRegistry({ bus, history, mcp });

  const { undo, redo } = createHistoryCommands(history);
  const historyModule: ModuleDefinition = {
    id: "history",
    name: "History",
    commands: [undo, redo],
    mcpTools: [
      commandTool(undo, { name: "history_undo" }),
      commandTool(redo, { name: "history_redo" }),
      defineMcpTool({
        name: "history_list",
        description:
          "Lists the undoable steps, oldest first, with who made each one (user, agent, plugin).",
        input: z.object({}),
        handler: (_input, ctx) => textResult(ctx.history.getSnapshot()),
      }),
    ],
  };
  await modules.load(historyModule);

  return { bus, history, mcp, modules };
}

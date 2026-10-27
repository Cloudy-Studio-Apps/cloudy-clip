import { z } from "zod";
import { commandTool, defineMcpTool, textResult } from "../mcp/define-mcp-tool";
import { defineModule, defineModuleRef } from "../module/define-module";
import type { ModuleDefinition } from "../module/module.types";
import { keybindings } from "../shell/shell.points";
import { createHistoryCommands } from "./history.commands";
import type { History } from "./history.types";

/** Handle of the built-in history module. */
export const historyRef = defineModuleRef("history");

/**
 * The built-in `history` module: undo/redo commands and tools over the kernel's shared history.
 * Created per kernel because its commands close over that kernel's `History`.
 */
export function createHistoryModule(history: History): ModuleDefinition {
  const { undo, redo } = createHistoryCommands(history);
  return defineModule({
    ref: historyRef,
    name: "History",
    tier: "core",
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
    setup(ctx) {
      const run = (command: string) => () => ({ command, input: {} });
      ctx.contribute(
        keybindings,
        { id: "history.undo", key: "z", mod: true, resolve: run(undo.id) },
        { id: "history.redo", key: "z", mod: true, shift: true, resolve: run(redo.id) },
        { id: "history.redo-y", key: "y", mod: true, resolve: run(redo.id) },
      );
      return {};
    },
  });
}

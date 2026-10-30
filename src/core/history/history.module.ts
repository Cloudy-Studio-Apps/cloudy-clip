import { z } from "zod";
import { commandTool, defineMcpTool, textResult } from "../mcp/mcp.tool";
import { defineModule, defineModuleRef } from "../module/module.define";
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
  const { undo, redo, undoFor } = createHistoryCommands(history);
  return defineModule({
    ref: historyRef,
    name: "History",
    tier: "core",
    commands: [undo, redo, undoFor],
    mcpTools: [
      commandTool(undo, { name: "history_undo", writes: true }),
      commandTool(redo, { name: "history_redo", writes: true }),
      defineMcpTool({
        name: "history_list",
        description:
          "Lists the undoable steps, oldest first, with who made each one (origin: user, agent or plugin; actor: which one).",
        input: z.object({}),
        readOnly: true,
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

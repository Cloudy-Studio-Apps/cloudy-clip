import { z } from "zod";
import { defineCommand } from "../command/command.define";
import { CommandFailure } from "../errors/result";
import type { History } from "./history.types";

/** Built-in undo/redo commands, so agents and plugins can undo through the bus too. */
export function createHistoryCommands(history: History) {
  const undo = defineCommand({
    id: "history.undo",
    label: "Undo",
    description: "Reverts the latest change, whoever made it (user or agent). Returns its label.",
    undoable: false,
    input: z.object({}),
    run() {
      const entry = history.undo();
      if (!entry) throw new CommandFailure("history.empty", "Nothing to undo");
      return { undone: entry.label, origin: entry.origin };
    },
  });

  const redo = defineCommand({
    id: "history.redo",
    label: "Redo",
    description: "Reapplies the latest undone change. Returns its label.",
    undoable: false,
    input: z.object({}),
    run() {
      const entry = history.redo();
      if (!entry) throw new CommandFailure("history.empty", "Nothing to redo");
      return { redone: entry.label, origin: entry.origin };
    },
  });

  return { undo, redo };
}

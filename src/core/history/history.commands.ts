import { z } from "zod";
import { LOCAL_ACTOR } from "../command/command.actor";
import { defineCommand } from "../command/command.define";
import type { ActorId } from "../command/command.types";
import { CommandFailure } from "../errors/result";
import type { History } from "./history.types";

/** Built-in undo/redo commands, so agents and plugins can undo through the bus too. */
export function createHistoryCommands(history: History) {
  /** The local user's `undo()` follows `scopeUndo`; anyone else acts on their own steps. */
  const own = (actor: ActorId) => (actor === LOCAL_ACTOR ? undefined : actor);

  const undo = defineCommand({
    id: "history.undo",
    label: "Undo",
    description:
      'Reverts your latest change. Fails with "history.conflict" if someone changed the same thing afterwards. Returns its label.',
    undoable: false,
    input: z.object({}),
    run(ctx) {
      const entry = history.undo(own(ctx.actor));
      if (!entry) throw new CommandFailure("history.empty", "Nothing to undo");
      return { undone: entry.label, origin: entry.origin };
    },
  });

  const redo = defineCommand({
    id: "history.redo",
    label: "Redo",
    description:
      'Reapplies your latest undone change. Fails with "history.conflict" if someone changed the same thing since. Returns its label.',
    undoable: false,
    input: z.object({}),
    run(ctx) {
      const entry = history.redo(own(ctx.actor));
      if (!entry) throw new CommandFailure("history.empty", "Nothing to redo");
      return { redone: entry.label, origin: entry.origin };
    },
  });

  /** Reverts a collaborator's latest step for the local user. Not available to agents. */
  const undoFor = defineCommand({
    id: "history.undoFor",
    label: "Undo collaborator's step",
    description: "Reverts another actor's latest change. Only the local user can do this.",
    undoable: false,
    input: z.object({ actor: z.string() }),
    run(ctx, { actor }) {
      if (ctx.actor !== LOCAL_ACTOR) {
        throw new CommandFailure("history.not_allowed", "Only the user can undo someone's step");
      }
      const entry = history.undo(actor);
      if (!entry) throw new CommandFailure("history.empty", "Nothing to undo");
      return { undone: entry.label, actor };
    },
  });

  return { undo, redo, undoFor };
}

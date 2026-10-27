import type { z } from "zod";
import type { CommandDefinition } from "./command.types";

/**
 * Declares a command. Identity function that exists for type inference: the input type of
 * `run` is inferred from the `input` schema.
 *
 * @example
 * export const splitClip = defineCommand({
 *   id: "timeline.splitClip",
 *   label: "Split clip",
 *   description: "Splits a clip in two at a timeline time.",
 *   undoable: true,
 *   input: z.object({ clipId: z.string(), at: z.number().int() }),
 *   run(ctx, { clipId, at }) { ... },
 * });
 */
export function defineCommand<I extends z.ZodType, O>(
  command: CommandDefinition<I, O>,
): CommandDefinition<I, O> {
  return command;
}

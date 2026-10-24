import type { Draft } from "immer";
import type { z } from "zod";
import type { AppError, Result } from "../errors/result.types";
import type { Logger } from "../errors/logger";
import type { PatchableStore } from "../store/store.types";

/** Who triggered a command. Recorded in history so the UI can show what an agent changed. */
export type CommandOrigin = "user" | "agent" | "plugin";

/** Passed to every command's `run`. The only way a command may change document state. */
export interface CommandContext {
  /** Who triggered this execution. */
  readonly origin: CommandOrigin;
  /** Logger scoped to the command id. */
  readonly log: Logger;
  /**
   * Changes a patchable store. Changes are recorded and, if the command throws, rolled back,
   * so a failing command never leaves state half-modified.
   */
  mutate<T extends object>(store: PatchableStore<T>, recipe: (draft: Draft<T>) => void): void;
  /** Runs another command inside this one. Its changes join this command's history entry. */
  execute<I extends z.ZodType, O>(command: CommandDefinition<I, O>, input: z.input<I>): Promise<O>;
}

/**
 * A named, typed, serializable action. Every change to the project goes through a command,
 * whether it comes from the UI, an agent over MCP, or a plugin.
 *
 * Define commands with {@link defineCommand} and register them through a module.
 */
export interface CommandDefinition<I extends z.ZodType = z.ZodType, O = unknown> {
  /** Namespaced id: `<module>.<action>`, e.g. `timeline.splitClip`. */
  readonly id: string;
  /** Short label for menus and the undo history, e.g. "Split clip". */
  readonly label: string;
  /** What it does, written for humans and agents. */
  readonly description: string;
  /** Whether the change is recorded in the undo history. */
  readonly undoable: boolean;
  /** Schema of the input. Validated before `run` is called. */
  readonly input: I;
  /** Performs the command. Throw `CommandFailure` for expected errors. */
  run(ctx: CommandContext, input: z.output<I>): O | Promise<O>;
}

/** Options for one execution. */
export interface ExecuteOptions {
  /** Defaults to `"user"`. */
  origin?: CommandOrigin;
}

/** Emitted after every command finishes, successfully or not. */
export interface CommandExecutedEvent {
  commandId: string;
  origin: CommandOrigin;
  result: Result<unknown, AppError>;
  durationMs: number;
}

/** Dispatches commands. One per kernel. */
export interface CommandBus {
  /** Registers a command. Fails if the id is already taken. */
  register(command: CommandDefinition): () => void;
  /** Runs a command by definition (typed). */
  run<I extends z.ZodType, O>(
    command: CommandDefinition<I, O>,
    input: z.input<I>,
    options?: ExecuteOptions,
  ): Promise<Result<O, AppError>>;
  /** Runs a command by id with untrusted input (MCP, plugins, scripting). */
  execute(id: string, input: unknown, options?: ExecuteOptions): Promise<Result<unknown, AppError>>;
  /** Looks up a registered command. */
  get(id: string): CommandDefinition | undefined;
  /** All registered commands. */
  list(): CommandDefinition[];
  /** Subscribes to execution events. Returns an unsubscribe function. */
  onExecuted(listener: (event: CommandExecutedEvent) => void): () => void;
}

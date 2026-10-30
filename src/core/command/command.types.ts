import type { History } from "../history/history.types";
import type { StoreChange } from "../store/store.types";
import type { Draft } from "immer";
import type { z } from "zod";
import type { AppError, Result } from "../errors/result.types";
import type { Logger } from "../errors/logger.types";
import type { ModuleRef } from "../module/module.types";
import type { PatchableStore } from "../store/store.types";

/** Who triggered a command. Recorded in history so the UI can show what an agent changed. */
export type CommandOrigin = "user" | "agent" | "plugin";

/**
 * Who a change belongs to: the local user, or a collaborator's stable key. Undo steps and
 * playheads are kept per actor.
 */
export type ActorId = string;

/** Passed to every command's `run`. The only way a command may change document state. */
export interface CommandContext {
  /** Who triggered this execution. */
  readonly origin: CommandOrigin;
  /** Whose change this is. */
  readonly actor: ActorId;
  /** Logger scoped to the command id. */
  readonly log: Logger;
  /**
   * Changes a patchable store. Changes are recorded and, if the command throws, rolled back,
   * so a failing command never leaves state half-modified.
   */
  mutate<T extends object>(store: PatchableStore<T>, recipe: (draft: Draft<T>) => void): void;
  /**
   * Returns a loaded module's API (its stores and services for this kernel). Throws
   * `CommandFailure("module.not_loaded")` if the module isn't active.
   */
  require<A>(ref: ModuleRef<A>): A;
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
  /** Defaults to the local user. */
  actor?: ActorId;
  /** Name of the undo step, instead of the command's label. */
  label?: string;
}

/** Emitted after every command finishes, successfully or not. */
export interface CommandExecutedEvent {
  commandId: string;
  origin: CommandOrigin;
  actor: ActorId;
  /** What the command changed (empty when it failed or changed nothing). */
  changes: StoreChange[];
  result: Result<unknown, AppError>;
  durationMs: number;
}

/**
 * Inputs of commands by id, for places that name a command by its id (an element's layout). Each
 * module extends it for its own commands:
 * `declare module "@/core" { interface CommandInputs { "text.applyPreset": { clipIds: string[]; preset: TextPresetId } } }`.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- filled by declaration merging
export interface CommandInputs {}

/** Ids of commands that can be placed in an inspector panel: their input takes `clipIds`. */
export type PanelCommandId = {
  [K in keyof CommandInputs]: CommandInputs[K] extends { clipIds: string[] } ? K : never;
}[keyof CommandInputs];

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

export interface CommandBusOptions {
  history: History;
  timeoutMs?: number;
  logger?: Logger;
  /** Resolves `ctx.require`. Without it, commands can't require modules (bus-only tests). */
  resolveModule?: <A>(ref: ModuleRef<A>) => A;
}

/** Mutable state of one top-level execution, shared with nested commands. */
export interface Transaction {
  origin: CommandOrigin;
  actor: ActorId;
  changes: StoreChange[];
  /** Set when the execution timed out: late mutations are refused. */
  closed: boolean;
}

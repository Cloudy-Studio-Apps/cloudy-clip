import type { z } from "zod";
import { createLogger, type Logger } from "../errors/logger";
import { CommandFailure, err, ok, toAppError } from "../errors/result";
import type { AppError, Result } from "../errors/result.types";
import type { History } from "../history/history.types";
import type { ModuleRef } from "../module/module.types";
import { asInternal } from "../store/patchable-store";
import type { StoreChange } from "../store/store.types";
import type {
  CommandBus,
  CommandContext,
  CommandDefinition,
  CommandExecutedEvent,
  CommandOrigin,
  ExecuteOptions,
} from "./command.types";

/** A command that takes longer than this is abandoned so it cannot block the queue forever. */
const DEFAULT_TIMEOUT_MS = 30_000;

interface CommandBusOptions {
  history: History;
  timeoutMs?: number;
  logger?: Logger;
  /** Resolves `ctx.require`. Without it, commands can't require modules (bus-only tests). */
  resolveModule?: <A>(ref: ModuleRef<A>) => A;
}

/** Mutable state of one top-level execution, shared with nested commands. */
interface Transaction {
  origin: CommandOrigin;
  changes: StoreChange[];
  /** Set when the execution timed out: late mutations are refused. */
  closed: boolean;
}

/**
 * Creates the command bus.
 *
 * Guarantees:
 * - **Validated:** input is parsed with the command's schema before `run` is called.
 * - **Serialized:** top-level commands run one at a time, in call order, so user and agent
 *   edits never interleave half-way.
 * - **Atomic:** if `run` throws, every change it made is rolled back.
 * - **Never throws:** every outcome is a {@link Result}.
 */
export function createCommandBus({
  history,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  logger = createLogger("command"),
  resolveModule,
}: CommandBusOptions): CommandBus {
  const commands = new Map<string, CommandDefinition>();
  const listeners = new Set<(event: CommandExecutedEvent) => void>();
  let queue: Promise<unknown> = Promise.resolve();

  function parseInput(command: CommandDefinition, input: unknown): Result<unknown, AppError> {
    const parsed = command.input.safeParse(input);
    if (parsed.success) return ok(parsed.data);
    const issues = parsed.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));
    const summary = issues.map((i) => (i.path ? `${i.path}: ${i.message}` : i.message)).join("; ");
    return err("invalid_input", `Invalid input for "${command.id}": ${summary}`, issues);
  }

  function createContext(command: CommandDefinition, tx: Transaction): CommandContext {
    const ctx: CommandContext = {
      origin: tx.origin,
      log: createLogger(command.id),
      mutate(store, recipe) {
        if (tx.closed) {
          throw new CommandFailure(
            "timeout",
            `"${command.id}" tried to change state after timing out`,
          );
        }
        const change = asInternal(store).produce(recipe);
        if (change) tx.changes.push(change);
      },
      require(ref) {
        try {
          if (!resolveModule) throw new Error("This bus has no modules");
          return resolveModule(ref);
        } catch (error) {
          throw new CommandFailure(
            "module.not_loaded",
            `"${command.id}" needs module "${ref.id}": ${String(error)}`,
          );
        }
      },
      async execute(nested, input) {
        const nestedCommand = nested as CommandDefinition;
        const parsed = parseInput(nestedCommand, input);
        if (!parsed.ok)
          throw new CommandFailure(parsed.error.code, parsed.error.message, parsed.error.details);
        return (await nestedCommand.run(createContext(nestedCommand, tx), parsed.value)) as never;
      },
    };
    return ctx;
  }

  function rollback(tx: Transaction): void {
    for (let i = tx.changes.length - 1; i >= 0; i--) {
      const change = tx.changes[i]!;
      asInternal(change.store).apply(change.inversePatches);
    }
    tx.changes = [];
  }

  async function runWithTimeout<T>(
    work: Promise<T>,
    commandId: string,
    tx: Transaction,
  ): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        tx.closed = true;
        reject(
          new CommandFailure("timeout", `"${commandId}" did not finish within ${timeoutMs} ms`),
        );
      }, timeoutMs);
    });
    try {
      return await Promise.race([work, timeout]);
    } finally {
      clearTimeout(timer);
    }
  }

  async function executeNow(
    command: CommandDefinition,
    input: unknown,
    origin: CommandOrigin,
  ): Promise<Result<unknown, AppError>> {
    const parsed = parseInput(command, input);
    if (!parsed.ok) return parsed;

    const tx: Transaction = { origin, changes: [], closed: false };
    try {
      const run = Promise.resolve().then(() =>
        command.run(createContext(command, tx), parsed.value),
      );
      const value = await runWithTimeout(run, command.id, tx);
      tx.closed = true;
      if (tx.changes.length > 0) {
        if (command.undoable) {
          history.push({
            commandId: command.id,
            label: command.label,
            origin,
            changes: tx.changes,
          });
        } else {
          logger.warn(`Non-undoable "${command.id}" changed a patchable store; history may drift`);
        }
      }
      return ok(value);
    } catch (error) {
      tx.closed = true;
      rollback(tx);
      const appError = toAppError(error);
      if (appError.code === "internal") logger.error(`"${command.id}" crashed`, error);
      return { ok: false, error: appError };
    }
  }

  function enqueue(
    command: CommandDefinition | undefined,
    id: string,
    input: unknown,
    options: ExecuteOptions | undefined,
  ): Promise<Result<unknown, AppError>> {
    const origin = options?.origin ?? "user";
    const task = queue.then(async () => {
      const started = performance.now();
      const result = command
        ? await executeNow(command, input, origin)
        : err("unknown_command", `No command registered with id "${id}"`);
      const event: CommandExecutedEvent = {
        commandId: id,
        origin,
        result,
        durationMs: performance.now() - started,
      };
      for (const listener of listeners) {
        try {
          listener(event);
        } catch (error) {
          logger.error("onExecuted listener threw", error);
        }
      }
      return result;
    });
    // Keep the queue alive even though `task` itself never rejects.
    queue = task.catch(() => undefined);
    return task;
  }

  return {
    register(command) {
      if (commands.has(command.id)) {
        throw new Error(`Command "${command.id}" is already registered`);
      }
      commands.set(command.id, command);
      return () => {
        if (commands.get(command.id) === command) commands.delete(command.id);
      };
    },
    run<I extends z.ZodType, O>(
      command: CommandDefinition<I, O>,
      input: z.input<I>,
      options?: ExecuteOptions,
    ) {
      return enqueue(command as CommandDefinition, command.id, input, options) as Promise<
        Result<O, AppError>
      >;
    },
    execute(id, input, options) {
      return enqueue(commands.get(id), id, input, options);
    },
    get: (id) => commands.get(id),
    list: () => [...commands.values()],
    onExecuted(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

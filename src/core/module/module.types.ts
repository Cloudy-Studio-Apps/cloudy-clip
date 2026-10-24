import type { CommandBus, CommandDefinition } from "../command/command.types";
import type { Logger } from "../errors/logger";
import type { History } from "../history/history.types";
import type { McpRegistry, McpToolDefinition } from "../mcp/mcp.types";

/** Cleans up whatever `activate` set up. */
export type Disposer = () => void;

/** What a module gets when it is activated. Plugins will receive exactly the same thing. */
export interface ModuleContext {
  readonly bus: CommandBus;
  readonly history: History;
  readonly mcp: McpRegistry;
  /** Logger scoped to the module id. */
  readonly log: Logger;
}

/**
 * A self-contained feature. Built-in modules and future plugins share this shape, so
 * built-ins get no capability a plugin could not have.
 *
 * Declarative parts (`commands`, `mcpTools`) are registered before `activate` runs.
 */
export interface ModuleDefinition {
  /** Unique, lowercase id. Also the namespace of its commands (`<id>.<action>`) and tools. */
  readonly id: string;
  /** Human-readable name. */
  readonly name: string;
  readonly commands?: ReadonlyArray<CommandDefinition>;
  readonly mcpTools?: ReadonlyArray<McpToolDefinition>;
  /** Imperative setup (listeners, background work). May return a disposer. */
  activate?(ctx: ModuleContext): void | Disposer | Promise<void | Disposer>;
}

/** Load state of a module. */
export type ModuleStatus = "active" | "failed";

/** Loads modules and keeps track of them. */
export interface ModuleRegistry {
  /**
   * Registers and activates a module. If activation fails, the module's commands and tools are
   * removed again and the module is marked failed; other modules keep working.
   */
  load(module: ModuleDefinition): Promise<ModuleStatus>;
  /** Deactivates every module, newest first. */
  unloadAll(): void;
  status(id: string): ModuleStatus | undefined;
}

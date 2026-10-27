import type { CommandBus, CommandDefinition } from "../command/command.types";
import type { Logger } from "../errors/logger";
import type { History } from "../history/history.types";
import type { McpRegistry, McpToolDefinition } from "../mcp/mcp.types";
import type { Point, PointReader } from "./points.types";

/** Cleans up whatever `setup` set up. */
export type Disposer = () => void;

/**
 * How a built-in module is written. `core`: the app can't exist without it (other modules
 * require it, or it owns points they extend); any module may require it unlisted. `feature`:
 * written only against the public API, as a plugin would be. Plugins leave it unset.
 */
export type ModuleTier = "core" | "feature";

/** Load state of a module. `skipped`: a module it needs is missing or failed. */
export type ModuleStatus = "active" | "failed" | "skipped";

/**
 * A typed handle to a module: its id plus the type of the API its `setup` returns. Export it
 * from the module's `index.ts` so others can `require` the module.
 */
export interface ModuleRef<Api> {
  readonly id: string;
  /** Phantom field carrying the API type. Never set. */
  readonly __api?: Api;
}

/** What `setup` returns: the module's public API for this kernel, and its cleanup. */
export type ModuleSetup<Api> = { dispose?: Disposer } & (undefined extends Api
  ? { api?: Api }
  : { api: Api });

/** What a module gets in `setup`. Plugins will receive exactly the same thing. */
export interface ModuleContext {
  readonly bus: CommandBus;
  readonly history: History;
  readonly mcp: McpRegistry;
  /** Logger scoped to the module id. */
  readonly log: Logger;
  /** Read access to every point. Read lazily (in handlers, components), not during `setup`. */
  readonly points: PointReader;
  /**
   * Returns another module's API. Allowed for core modules, modules listed in `requires` or
   * `uses`, and the module itself. Throws if the module isn't loaded (yet): core modules load
   * before features, but list a module in `requires` to rely on it during `setup`.
   */
  require<A>(ref: ModuleRef<A>): A;
  /** Adds items to a point on behalf of this module. Removed when the module unloads. */
  contribute<T>(point: Point<T>, ...items: T[]): void;
  /**
   * Registers a cleanup (unlisten, unsubscribe, ...) right after acquiring the resource. It runs
   * when the module unloads, and also if `setup` throws later, so nothing leaks.
   */
  onDispose(cleanup: Disposer): void;
}

/**
 * A self-contained feature. Built-in modules and future plugins share this shape, so
 * built-ins get no capability a plugin could not have.
 *
 * Declarative parts (`commands`, `mcpTools`) are registered before `setup` runs.
 */
export interface ModuleDefinition<Api = void> {
  /** Its id (lowercase, the namespace of its commands `<id>.<action>` and tools) and API type. */
  readonly ref: ModuleRef<Api>;
  /** Human-readable name. */
  readonly name: string;
  readonly tier?: ModuleTier;
  /** Modules that must be loaded first. If one is missing or fails, this one is skipped. */
  readonly requires?: readonly string[];
  /**
   * Modules that must be loaded, loaded first when possible (mutual `uses` is allowed). A `uses`
   * module may not be set up yet during `setup`: `require` it lazily (in handlers).
   */
  readonly uses?: readonly string[];
  /** Modules to load before this one when present. Orders only. */
  readonly after?: readonly string[];
  readonly commands?: ReadonlyArray<CommandDefinition>;
  readonly mcpTools?: ReadonlyArray<McpToolDefinition>;
  /** Creates the module's state and services for one kernel and contributes to points. */
  setup?(ctx: ModuleContext): ModuleSetup<Api> | Promise<ModuleSetup<Api>>;
}

/**
 * Any module definition, with its API type erased. What the registry accepts, so modules with
 * different API types can be listed together.
 */
export interface AnyModuleDefinition extends Omit<ModuleDefinition<unknown>, "ref" | "setup"> {
  readonly ref: { readonly id: string };
  setup?(ctx: ModuleContext): unknown;
}

/** Loads modules and keeps track of them. One per kernel. */
export interface ModuleRegistry {
  /**
   * Orders modules by `requires`/`uses`/`after` and loads them. A module whose setup throws is
   * removed again (commands, tools, contributions) and marked `failed`; modules that need it are
   * `skipped`. Throws only on a dependency cycle.
   */
  loadAll(modules: readonly AnyModuleDefinition[]): Promise<Record<string, ModuleStatus>>;
  /** Loads one module. Its dependencies must already be loaded. */
  load(module: AnyModuleDefinition): Promise<ModuleStatus>;
  /** Returns an active module's API. Throws if it isn't active. */
  require<A>(ref: ModuleRef<A>): A;
  status(id: string): ModuleStatus | undefined;
  /** Disposes every module, newest first. */
  unloadAll(): void;
}

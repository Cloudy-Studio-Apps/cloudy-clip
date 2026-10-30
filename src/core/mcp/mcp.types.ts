import type { ModuleRegistry } from "../module/module.types";
import type { z } from "zod";
import type { ActorId, CommandBus } from "../command/command.types";
import type { AppError } from "../errors/result.types";
import type { History } from "../history/history.types";
import type { ModuleRef } from "../module/module.types";

/** One piece of content returned to the agent. */
export type McpContent =
  { type: "text"; text: string } | { type: "image"; data: string; mimeType: string };

/** What a tool returns. `isError` tells the agent the call failed (with the reason in content). */
export interface McpToolResult {
  content: McpContent[];
  isError?: boolean;
}

/** A connected client, as the native server identifies it. */
export interface McpCaller {
  /** Stable across reconnects of the same client. */
  key: ActorId;
  name: string;
  version?: string;
}

/** Passed to every tool handler. */
export interface McpToolContext {
  /** Runs commands as the caller, with origin `"agent"`. */
  readonly bus: CommandBus;
  readonly history: History;
  readonly caller: McpCaller;
  /** Returns a loaded module's API, e.g. to read its state. Throws if it isn't active. */
  require<A>(ref: ModuleRef<A>): A;
}

/**
 * An MCP tool exposed to agents. Each module declares its tools in `<module>.mcp.ts`.
 *
 * Tools are thin: they validate input and run commands (as their caller) or read state.
 * They never contain editing logic of their own, so agents and users stay equal.
 */
export interface McpToolDefinition<I extends z.ZodObject = z.ZodObject> {
  /** `snake_case`, prefixed with the module id: `timeline_split_clip`. */
  readonly name: string;
  /** Written for an agent: what it does, units, and what it returns. */
  readonly description: string;
  /** Input schema. Must be an object (MCP requirement). */
  readonly input: I;
  /** Changes nothing in the project, so it stays open to a view-only agent. Defaults to false. */
  readonly readOnly?: boolean;
  handler(input: z.output<I>, ctx: McpToolContext): McpToolResult | Promise<McpToolResult>;
}

/** Serializable tool description sent to the native MCP server. */
export interface McpToolManifest {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

/** A tool call forwarded from the native MCP server. */
export interface McpCall {
  /** Correlates the response with the call. */
  id: string;
  name: string;
  arguments: unknown;
  /** Who is calling. */
  caller?: McpCaller;
}

/** What an observer decides about a call. */
export interface McpCallVerdict {
  /** Refuses the call with this error; the tool doesn't run. */
  deny?: AppError;
  /** Names the undo steps the call makes. */
  label?: string;
}

/** Watches agents' calls. How a feature tracks collaborators without the kernel knowing it. */
export interface McpObserver {
  connected(caller: McpCaller): void;
  call(caller: McpCaller, tool: McpToolDefinition): McpCallVerdict;
  /** Runs after the tool. Returns notes to append to the agent's reply. */
  finished(caller: McpCaller, tool: McpToolDefinition, result: McpToolResult): string[];
}

/** Holds every tool registered by modules and plugins. */
export interface McpRegistry {
  /** Registers a tool. Fails if the name is taken. Returns an unregister function. */
  register(tool: McpToolDefinition): () => void;
  get(name: string): McpToolDefinition | undefined;
  list(): McpToolDefinition[];
  /** Builds the manifest with JSON schemas. */
  manifest(): McpToolManifest[];
  /** Called whenever the tool set changes. */
  onChange(listener: () => void): () => void;
  /** Sets the observer of agents' calls (one at a time). Returns the unregister function. */
  observe(observer: McpObserver): () => void;
  observer(): McpObserver | null;
}

/** How the bridge talks to the native side. Abstracted so it can be tested without Tauri. */
export interface McpTransport {
  registerTools(manifest: McpToolManifest[]): Promise<void>;
  onCall(handler: (call: McpCall) => void): Promise<() => void>;
  onConnected(handler: (caller: McpCaller) => void): Promise<() => void>;
  respond(id: string, result: McpToolResult): Promise<void>;
}

export interface McpBridgeOptions {
  registry: McpRegistry;
  transport: McpTransport;
  bus: CommandBus;
  history: History;
  modules: Pick<ModuleRegistry, "require">;
}

/** Connects the tool registry to the native MCP server. */
export interface McpBridge {
  /** Publishes the tools and starts answering calls. Safe to call once. */
  start(): Promise<void>;
  stop(): void;
  /** Handles one call. Exposed for tests. Never throws. */
  handle(call: McpCall): Promise<McpToolResult>;
}

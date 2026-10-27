import type { z } from "zod";
import type { CommandBus } from "../command/command.types";
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

/** Passed to every tool handler. */
export interface McpToolContext {
  readonly bus: CommandBus;
  readonly history: History;
  /** Returns a loaded module's API, e.g. to read its state. Throws if it isn't active. */
  require<A>(ref: ModuleRef<A>): A;
}

/**
 * An MCP tool exposed to agents. Each module declares its tools in `<module>.mcp.ts`.
 *
 * Tools are thin: they validate input and run commands (with origin `"agent"`) or read state.
 * They never contain editing logic of their own, so agents and users stay equal.
 */
export interface McpToolDefinition<I extends z.ZodObject = z.ZodObject> {
  /** `snake_case`, prefixed with the module id: `timeline_split_clip`. */
  readonly name: string;
  /** Written for an agent: what it does, units, and what it returns. */
  readonly description: string;
  /** Input schema. Must be an object (MCP requirement). */
  readonly input: I;
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
}

/** How the bridge talks to the native side. Abstracted so it can be tested without Tauri. */
export interface McpTransport {
  registerTools(manifest: McpToolManifest[]): Promise<void>;
  onCall(handler: (call: McpCall) => void): Promise<() => void>;
  respond(id: string, result: McpToolResult): Promise<void>;
}

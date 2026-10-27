import { toInputJsonSchema } from "./mcp.tool";
import type { McpRegistry, McpToolDefinition, McpToolManifest } from "./mcp.types";

const TOOL_NAME = /^[a-z][a-z0-9_]{0,63}$/;

/** Creates the registry of MCP tools. */
export function createMcpRegistry(): McpRegistry {
  const tools = new Map<string, McpToolDefinition>();
  const listeners = new Set<() => void>();
  let cachedManifest: McpToolManifest[] | null = null;

  function changed(): void {
    cachedManifest = null;
    for (const listener of listeners) listener();
  }

  return {
    register(tool) {
      if (!TOOL_NAME.test(tool.name)) {
        throw new Error(`MCP tool name "${tool.name}" must be snake_case (a-z, 0-9, _)`);
      }
      if (tools.has(tool.name)) throw new Error(`MCP tool "${tool.name}" is already registered`);
      tools.set(tool.name, tool);
      changed();
      return () => {
        if (tools.get(tool.name) === tool) {
          tools.delete(tool.name);
          changed();
        }
      };
    },
    get: (name) => tools.get(name),
    list: () => [...tools.values()],
    manifest() {
      cachedManifest ??= [...tools.values()].map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: toInputJsonSchema(tool.input),
      }));
      return cachedManifest;
    },
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

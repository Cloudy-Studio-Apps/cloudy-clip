import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { McpCall, McpCaller, McpTransport } from "./mcp.types";

/** {@link McpTransport} over Tauri commands and events (see `src-tauri/src/mcp`). */
export function createTauriMcpTransport(): McpTransport {
  return {
    registerTools: (manifest) => invoke("mcp_register_tools", { tools: manifest }),
    onCall: (handler) => listen<McpCall>("mcp://call", (event) => handler(event.payload)),
    onConnected: (handler) =>
      listen<McpCaller>("mcp://connected", (event) => handler(event.payload)),
    respond: (id, result) => invoke("mcp_respond", { id, result }),
  };
}

import type { CommandBus } from "../command/command.types";
import { createLogger } from "../errors/logger";
import { toAppError } from "../errors/result";
import type { History } from "../history/history.types";
import type { ModuleRegistry } from "../module/module.types";
import { errorResult } from "./define-mcp-tool";
import type { McpCall, McpRegistry, McpToolResult, McpTransport } from "./mcp.types";

const log = createLogger("mcp");

interface McpBridgeOptions {
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

/** Creates the bridge between the webview tool registry and the native MCP server. */
export function createMcpBridge({
  registry,
  transport,
  bus,
  history,
  modules,
}: McpBridgeOptions): McpBridge {
  const disposers: Array<() => void> = [];
  let publishTimer: ReturnType<typeof setTimeout> | undefined;

  async function handle(call: McpCall): Promise<McpToolResult> {
    const tool = registry.get(call.name);
    if (!tool)
      return errorResult({ code: "unknown_tool", message: `No tool named "${call.name}"` });

    const parsed = tool.input.safeParse(call.arguments ?? {});
    if (!parsed.success) {
      const message = parsed.error.issues
        .map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message))
        .join("; ");
      return errorResult({ code: "invalid_input", message });
    }
    try {
      return await tool.handler(parsed.data, { bus, history, require: modules.require });
    } catch (error) {
      log.error(`Tool "${call.name}" crashed`, error);
      return errorResult(toAppError(error));
    }
  }

  async function publish(): Promise<void> {
    try {
      await transport.registerTools(registry.manifest());
    } catch (error) {
      log.error("Could not publish MCP tools", error);
    }
  }

  return {
    async start() {
      disposers.push(
        await transport.onCall((call) => {
          void handle(call).then((result) =>
            transport.respond(call.id, result).catch((error) => {
              log.error(`Could not answer call "${call.id}"`, error);
            }),
          );
        }),
      );
      // Tools registered later (e.g. by plugins) are re-published, batched.
      disposers.push(
        registry.onChange(() => {
          clearTimeout(publishTimer);
          publishTimer = setTimeout(() => void publish(), 50);
        }),
      );
      await publish();
    },
    stop() {
      clearTimeout(publishTimer);
      for (const dispose of disposers.splice(0)) dispose();
    },
    handle,
  };
}

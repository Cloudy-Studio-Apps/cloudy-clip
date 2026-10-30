import { createLogger } from "../errors/logger";
import { toAppError } from "../errors/result";
import { errorResult } from "./mcp.tool";
import type { CommandBus, ExecuteOptions } from "../command/command.types";
import type {
  McpBridge,
  McpBridgeOptions,
  McpCall,
  McpCaller,
  McpToolDefinition,
  McpToolResult,
} from "./mcp.types";

const log = createLogger("mcp");

/** A call that reached the bridge without saying who made it. */
const UNKNOWN_CALLER: McpCaller = { key: "agent", name: "Agent" };

/** The bus as a tool sees it: everything runs as its caller. */
function busFor(bus: CommandBus, caller: McpCaller, label: string | undefined): CommandBus {
  const asCaller = (options?: ExecuteOptions): ExecuteOptions => ({
    origin: "agent",
    actor: caller.key,
    ...(label === undefined ? {} : { label }),
    ...options,
  });
  return {
    ...bus,
    run: (command, input, options) => bus.run(command, input, asCaller(options)),
    execute: (id, input, options) => bus.execute(id, input, asCaller(options)),
  };
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

  /** Runs an observer's hook; a broken observer must not break the agent's call. */
  function observing<T>(run: () => T, fallback: T): T {
    try {
      return run();
    } catch (error) {
      log.error("MCP observer threw", error);
      return fallback;
    }
  }

  async function handle(call: McpCall): Promise<McpToolResult> {
    const tool = registry.get(call.name);
    if (!tool)
      return errorResult({ code: "unknown_tool", message: `No tool named "${call.name}"` });
    const caller = call.caller ?? UNKNOWN_CALLER;
    const observer = registry.observer();
    const verdict = observer ? observing(() => observer.call(caller, tool), {}) : {};
    if (verdict.deny) return errorResult(verdict.deny);

    const result = await runTool(call, tool, caller, verdict.label);
    if (!observer) return result;
    const notes = observing(() => observer.finished(caller, tool, result), []);
    return notes.length === 0
      ? result
      : {
          ...result,
          content: [...result.content, ...notes.map((text) => ({ type: "text" as const, text }))],
        };
  }

  async function runTool(
    call: McpCall,
    tool: McpToolDefinition,
    caller: McpCaller,
    label: string | undefined,
  ): Promise<McpToolResult> {
    const parsed = tool.input.safeParse(call.arguments ?? {});
    if (!parsed.success) {
      const message = parsed.error.issues
        .map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message))
        .join("; ");
      return errorResult({ code: "invalid_input", message });
    }
    try {
      return await tool.handler(parsed.data, {
        bus: busFor(bus, caller, label),
        history,
        caller,
        require: modules.require,
      });
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
        await transport.onConnected((caller) => {
          const observer = registry.observer();
          if (observer) observing(() => observer.connected(caller), undefined);
        }),
      );
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

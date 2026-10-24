import {
  createKernel,
  createLogger,
  createMcpBridge,
  createTauriMcpTransport,
  notify,
  type Kernel,
  type ModuleDefinition,
} from "@/core";
import { mediaModule } from "@/modules/media";
import { previewModule } from "@/modules/preview";
import { projectModule } from "@/modules/project";
import { timelineModule } from "@/modules/timeline";

const log = createLogger("app");

/** Built-in modules, in load order. Plugins will be appended here by the future loader. */
const MODULES: ModuleDefinition[] = [projectModule, mediaModule, timelineModule, previewModule];

/**
 * Starts the editor: creates the kernel, loads modules, surfaces command results to the user,
 * and connects the MCP bridge so agents can drive the editor.
 */
export async function bootstrap(): Promise<Kernel> {
  const kernel = await createKernel();

  for (const module of MODULES) {
    const status = await kernel.modules.load(module);
    if (status === "failed") notify("error", `${module.name} failed to load; see the logs.`);
  }

  kernel.bus.onExecuted(({ origin, result, commandId }) => {
    const command = kernel.bus.get(commandId);
    if (!result.ok) {
      if (origin === "user") notify("error", result.error.message);
    } else if (origin === "agent" && command?.undoable) {
      // Tell the user what an agent changed. It can be undone like any edit.
      notify("info", `Agent: ${command.label}`);
    }
  });

  const bridge = createMcpBridge({
    registry: kernel.mcp,
    transport: createTauriMcpTransport(),
    bus: kernel.bus,
    history: kernel.history,
  });
  bridge.start().catch((error: unknown) => log.error("MCP bridge failed to start", error));

  return kernel;
}

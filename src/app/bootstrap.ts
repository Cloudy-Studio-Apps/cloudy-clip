import {
  createKernel,
  createLogger,
  createMcpBridge,
  createTauriMcpTransport,
  notify,
  type Kernel,
  type AnyModuleDefinition,
} from "@/core";
import { audioModule } from "@/modules/audio";
import { collabModule } from "@/modules/collab";
import { compositionModule } from "@/modules/composition";
import { elementModule } from "@/modules/element";
import { exportModule } from "@/modules/export";
import { fontsModule } from "@/modules/fonts";
import { inspectorModule } from "@/modules/inspector";
import { junctionModule } from "@/modules/junction";
import { mediaModule } from "@/modules/media";
import { previewModule } from "@/modules/preview";
import { projectModule } from "@/modules/project";
import { solidModule } from "@/modules/solid";
import { soundModule } from "@/modules/sound";
import { stickerModule } from "@/modules/sticker";
import { textModule } from "@/modules/text";
import { timelineModule } from "@/modules/timeline";
import { transformModule } from "@/modules/transform";
import { transitionModule } from "@/modules/transition";
import { workspaceModule } from "@/modules/workspace";

const log = createLogger("app");

/** Built-in modules, in any order: the kernel orders them by their dependencies. */
const MODULES: AnyModuleDefinition[] = [
  projectModule,
  elementModule,
  junctionModule,
  fontsModule,
  mediaModule,
  timelineModule,
  previewModule,
  compositionModule,
  inspectorModule,
  transformModule,
  textModule,
  transitionModule,
  stickerModule,
  solidModule,
  audioModule,
  collabModule,
  soundModule,
  exportModule,
  workspaceModule,
];

/**
 * Starts the editor: creates the kernel, loads modules, surfaces command results to the user,
 * and connects the MCP bridge so agents can drive the editor.
 */
export async function bootstrap(): Promise<Kernel> {
  const kernel = await createKernel();

  const statuses = await kernel.modules.loadAll(MODULES);
  for (const module of MODULES) {
    const status = statuses[module.ref.id];
    if (status === "failed") notify("error", `${module.name} failed to load; see the logs.`);
    if (status === "skipped") {
      notify("error", `${module.name} was skipped: a module it needs did not load.`);
    }
  }

  kernel.bus.onExecuted(({ origin, actor, result, commandId }) => {
    const command = kernel.bus.get(commandId);
    if (!result.ok) {
      if (origin === "user") notify("error", result.error.message);
    } else if (origin === "agent" && command?.undoable) {
      // Tell the user what an agent changed. It can be undone like any edit.
      notify("info", `${kernel.history.nameOf(actor)}: ${command.label}`);
    }
  });

  const bridge = createMcpBridge({
    registry: kernel.mcp,
    transport: createTauriMcpTransport(),
    bus: kernel.bus,
    history: kernel.history,
    modules: kernel.modules,
  });
  bridge.start().catch((error: unknown) => log.error("MCP bridge failed to start", error));

  return kernel;
}

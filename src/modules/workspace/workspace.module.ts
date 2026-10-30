import { appOverlays, defineModule, keybindings, notify, topBarItems } from "@/core";
import { mediaRef } from "@/modules/media";
import { previewRef } from "@/modules/preview";
import { projectRef } from "@/modules/project";
import { createPickers } from "./workspace.ask";
import {
  askOpen,
  askSaveAs,
  saveProject,
  showStart,
  workspaceCommands,
} from "./workspace.commands";
import { workspaceMcpTools } from "./workspace.mcp";
import { workspaceRef } from "./workspace.ref";
import { onWindowClose } from "./workspace.service";
import { createWorkspace } from "./workspace.session";
import type { WorkspaceApi } from "./workspace.types";
import { ProjectTitle, RelinkHost, StartDialogHost } from "./ui";

/** The open project: the start dialog, saving, opening, the recent list. */
export const workspaceModule = defineModule({
  ref: workspaceRef,
  name: "Workspace",
  tier: "core",
  requires: ["project", "media", "preview", "composition"],
  commands: workspaceCommands,
  mcpTools: workspaceMcpTools,
  async setup({ bus, history, log, contribute, require, onDispose }) {
    const core = createWorkspace({
      project: require(projectRef),
      media: require(mediaRef),
      preview: require(previewRef),
      nameOf: history.nameOf,
    });
    onDispose(core.dispose);
    const api: WorkspaceApi = { ...core, ...createPickers(bus, core) };
    void core.recents.load();

    let warned = false;
    try {
      const stop = await onWindowClose(async () => {
        const left = await core.leave().then(
          () => true,
          () => false,
        );
        if (left || warned) return true;
        warned = true;
        notify("error", "Your project isn't saved. Close again to quit without saving.");
        return false;
      });
      onDispose(stop);
    } catch (error) {
      log.warn("Saving on close is unavailable", error);
    }

    contribute(
      appOverlays,
      { id: "workspace.start", component: StartDialogHost },
      { id: "workspace.relink", component: RelinkHost },
    );
    contribute(topBarItems, { id: "workspace.title", slot: "left", component: ProjectTitle });
    const key = (id: string, keyName: string, command: string, shift = false) => ({
      id: `workspace.${id}`,
      key: keyName,
      mod: true,
      shift,
      resolve: () => ({ command, input: {} }),
    });
    contribute(
      keybindings,
      key("save", "s", saveProject.id),
      key("save-as", "s", askSaveAs.id, true),
      key("open", "o", askOpen.id),
      key("home", "n", showStart.id),
    );
    return { api };
  },
});

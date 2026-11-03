import {
  appMenuItems,
  appOverlays,
  CommandFailure,
  defineModule,
  keybindings,
  notify,
  topBarItems,
} from "@/core";
import { mediaRef } from "@/modules/media";
import { previewRef } from "@/modules/preview";
import { projectRef } from "@/modules/project";
import { createPickers } from "./workspace.ask";
import {
  askOpen,
  openProject,
  askSaveAs,
  saveProject,
  showStart,
  workspaceCommands,
} from "./workspace.commands";
import { workspaceMcpTools } from "./workspace.mcp";
import { workspaceRef } from "./workspace.ref";
import { onWindowClose } from "./workspace.service";
import { createWorkspace } from "./workspace.session";
import type { LeaveRun, WorkspaceApi } from "./workspace.types";
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

    // Closing the window runs no command, so work before leaving goes through the bus.
    const run: LeaveRun = async (command, input) => {
      const result = await bus.run(command, input);
      if (!result.ok) throw new CommandFailure(result.error.code, result.error.message);
      return result.value;
    };
    let warned = false;
    try {
      const stop = await onWindowClose(async () => {
        const left = await core.leave(run).then(
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
    const entry = (id: string, label: string, order: number) => ({
      id: `workspace.${id}`,
      menu: "File",
      label,
      order,
      keybinding: `workspace.${id === "new" ? "home" : id}`,
    });
    contribute(
      appMenuItems,
      entry("new", "New project…", 10),
      entry("open", "Open…", 20),
      {
        id: "workspace.recent",
        menu: "File",
        label: "Open recent",
        order: 30,
        items: () => {
          const { items, gone } = core.recents.store.getState();
          return items
            .filter(({ path }) => !gone.includes(path))
            .slice(0, 10)
            .map(({ name, path }) => ({
              label: name,
              onSelect: () => void bus.run(openProject, { path }),
            }));
        },
      },
      entry("save", "Save", 40),
      entry("save-as", "Save As…", 50),
    );
    return { api };
  },
});

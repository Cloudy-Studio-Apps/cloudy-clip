import { open, save } from "@tauri-apps/plugin-dialog";
import type { CommandBus } from "@/core";
import { PROJECT_EXTENSION } from "./logic/names";
import { openProject, saveProjectAs } from "./workspace.commands";
import type { WorkspaceCore } from "./workspace.types";

const FILTERS = [{ name: "Cloudy Clip project", extensions: [PROJECT_EXTENSION] }];

/**
 * The file pickers. Each waits for a person, so it runs outside the bus, which would otherwise
 * hold every other command until they answer, and runs its command after.
 */
export function createPickers(bus: CommandBus, workspace: WorkspaceCore) {
  return {
    askOpen() {
      void (async () => {
        const path = await open({ multiple: false, directory: false, filters: FILTERS });
        if (path) await bus.run(openProject, { path });
      })();
    },
    askSaveAs() {
      void (async () => {
        const { name } = workspace.session.getState();
        const defaultPath = `${await workspace.folder()}/${name}.${PROJECT_EXTENSION}`;
        const path = await save({ defaultPath, filters: FILTERS });
        if (path) await bus.run(saveProjectAs, { path });
      })();
    },
  };
}

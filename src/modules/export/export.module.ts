import { Upload } from "lucide-react";
import { appMenuItems, appPages, defineModule, PAGE_GROUP_DELIVER, showPage } from "@/core";
import { mediaRef } from "@/modules/media";
import { previewRef } from "@/modules/preview";
import { exportCommands } from "./export.commands";
import { exportMcpTools } from "./export.mcp";
import { exportRef } from "./export.ref";
import { createExportRunner } from "./export.runner";
import { defaultFolder, readCapabilities } from "./export.service";
import {
  createCapabilitiesStore,
  createFormStore,
  createQueueStore,
  savedFolder,
} from "./export.store";

import { ExportPage } from "./ui";

/** Turns compositions into files: the Export page and its queue. */
export const exportModule = defineModule({
  ref: exportRef,
  name: "Export",
  tier: "feature",
  requires: ["project", "media", "preview", "workspace"],
  commands: exportCommands,
  mcpTools: exportMcpTools,
  setup({ bus, contribute, require, onDispose, log }) {
    const queue = createQueueStore();
    const form = createFormStore();
    const capabilities = createCapabilitiesStore();
    const runner = createExportRunner({
      queue,
      preview: require(previewRef),
      media: require(mediaRef),
      log,
    });
    onDispose(runner.dispose);

    form.setState({ folder: savedFolder() ?? "" });
    if (!form.getState().folder) {
      void defaultFolder().then((folder) => form.setState({ folder }));
    }
    readCapabilities()
      .then((value) => capabilities.setState({ value }))
      .catch((error: unknown) => log.warn("Could not read what FFmpeg can do", error));

    contribute(appMenuItems, {
      id: "export.open",
      menu: "File",
      label: "Export…",
      order: 70,
      run: () => void bus.run(showPage, { page: "export.page" }),
    });
    contribute(appPages, {
      id: "export.page",
      label: "Export",
      icon: Upload,
      group: PAGE_GROUP_DELIVER,
      order: 10,
      component: ExportPage,
    });

    return { api: { queue, form, capabilities, runner } };
  },
});

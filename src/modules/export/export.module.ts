import { appPages, defineModule, EDITOR_PAGE, pagesRef } from "@/core";
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
  setup({ contribute, require, onDispose, log }) {
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

    // The page covers the preview, so nothing should keep playing behind it.
    const pages = require(pagesRef).store;
    const { playback } = require(previewRef);
    onDispose(
      pages.subscribe(({ active }) => {
        if (active !== EDITOR_PAGE) playback.pause();
      }),
    );
    contribute(appPages, { id: "export.page", label: "Export", component: ExportPage });

    return { api: { queue, form, capabilities, runner } };
  },
});

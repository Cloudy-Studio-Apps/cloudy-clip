import { getCurrentWebview } from "@tauri-apps/api/webview";
import { defineModule, layoutPanels } from "@/core";
import { projectRef } from "@/modules/project";
import { importMedia, mediaCommands } from "./media.commands";
import { mediaMcpTools } from "./media.mcp";
import { createProbeQueue } from "./media.probe";
import { mediaRef } from "./media.ref";
import { createMediaService } from "./media.service";
import { createMediaState, isProxySettled } from "./media.store";
import { MediaLibrary } from "./ui";

/** Importing files, reading their metadata, proxies, and the media library panel. */
export const mediaModule = defineModule({
  ref: mediaRef,
  name: "Media",
  tier: "core",
  requires: ["project"],
  commands: mediaCommands,
  mcpTools: mediaMcpTools,
  async setup({ bus, log, contribute, require }) {
    const project = require(projectRef).store;
    const state = createMediaState();
    const { fileDrop, getProbe, setProbe } = state;
    const service = createMediaService(state);
    await service.init();
    const unlistenProxies = await service.listenToProxies();
    const probes = createProbeQueue({ state, mediaUrl: service.mediaUrl });

    // Read metadata of every media item in the project (import, redo, future loading) once
    // its proxy pipeline has settled.
    const probeAll = () => {
      const { media, mediaOrder } = project.getState();
      for (const id of mediaOrder) {
        const asset = media[id];
        if (!asset) continue;
        const probe = getProbe(id);
        if (!probe) setProbe(id, { status: "pending" });
        else if (isProxySettled(probe.proxy)) probes.enqueue(asset);
      }
    };
    probeAll();
    const offProject = project.subscribe((next, previous) => {
      if (next.mediaOrder !== previous.mediaOrder) probeAll();
    });
    const offProbes = state.probes.subscribe(probeAll);

    // Files dropped onto the window from the OS.
    let unlisten: (() => void) | undefined;
    try {
      unlisten = await getCurrentWebview().onDragDropEvent((event) => {
        const payload = event.payload;
        if (payload.type === "enter" || payload.type === "over") {
          if (!fileDrop.getState().active) fileDrop.setState({ active: true });
        } else {
          fileDrop.setState({ active: false });
          if (payload.type === "drop" && payload.paths.length > 0) {
            void bus.run(importMedia, { paths: payload.paths });
          }
        }
      });
    } catch (error) {
      log.warn("File drop is unavailable", error);
    }

    contribute(layoutPanels, {
      id: "media.library",
      title: "Media",
      slot: "side",
      component: MediaLibrary,
    });

    return {
      api: {
        probes: state.probes,
        fileDrop,
        getProbe,
        waitForProbe: state.waitForProbe,
        mediaUrl: service.mediaUrl,
      },
      dispose() {
        offProject();
        offProbes();
        unlistenProxies();
        unlisten?.();
      },
    };
  },
});

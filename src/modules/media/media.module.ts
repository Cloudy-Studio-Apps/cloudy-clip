import { getCurrentWebview } from "@tauri-apps/api/webview";
import { defineModule, layoutPanels } from "@/core";
import { projectStore } from "@/modules/project";
import { importMedia, mediaCommands } from "./media.commands";
import { mediaMcpTools } from "./media.mcp";
import { enqueueProbe } from "./media.probe";
import { mediaRef } from "./media.ref";
import { initMediaServer, listenToProxies } from "./media.service";
import { fileDropStore, getProbe, isProxySettled, mediaProbeStore, setProbe } from "./media.store";
import { MediaLibrary } from "./ui";

/** Importing files, reading their metadata, proxies, and the media library panel. */
export const mediaModule = defineModule({
  ref: mediaRef,
  name: "Media",
  tier: "core",
  requires: ["project"],
  commands: mediaCommands,
  mcpTools: mediaMcpTools,
  async setup({ bus, log, contribute }) {
    await initMediaServer();
    const unlistenProxies = await listenToProxies();

    // Read metadata of every media item in the project (import, redo, future loading) once
    // its proxy pipeline has settled.
    const probeAll = () => {
      const { media, mediaOrder } = projectStore.getState();
      for (const id of mediaOrder) {
        const asset = media[id];
        if (!asset) continue;
        const probe = getProbe(id);
        if (!probe) setProbe(id, { status: "pending" });
        else if (isProxySettled(probe.proxy)) enqueueProbe(asset);
      }
    };
    probeAll();
    const offProject = projectStore.subscribe((state, previous) => {
      if (state.mediaOrder !== previous.mediaOrder) probeAll();
    });
    const offProbes = mediaProbeStore.subscribe(probeAll);

    // Files dropped onto the window from the OS.
    let unlisten: (() => void) | undefined;
    try {
      unlisten = await getCurrentWebview().onDragDropEvent((event) => {
        const payload = event.payload;
        if (payload.type === "enter" || payload.type === "over") {
          if (!fileDropStore.getState().active) fileDropStore.setState({ active: true });
        } else {
          fileDropStore.setState({ active: false });
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
      dispose() {
        offProject();
        offProbes();
        unlistenProxies();
        unlisten?.();
      },
    };
  },
});

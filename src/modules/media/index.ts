/**
 * Media module: importing files, reading their metadata, and the media library panel.
 * @module media
 */
import { getCurrentWebview } from "@tauri-apps/api/webview";
import type { ModuleDefinition } from "@/core";
import { projectStore } from "@/modules/project";
import { importMedia, mediaCommands } from "./media.commands";
import { mediaMcpTools } from "./media.mcp";
import { enqueueProbe } from "./media.probe";
import { initMediaServer, listenToProxies } from "./media.service";
import { fileDropStore, getProbe, isProxySettled, mediaProbeStore, setProbe } from "./media.store";

export { importMedia, removeMedia } from "./media.commands";
export { MEDIA_DRAG_END, MEDIA_DRAG_MOVE, MEDIA_DROP } from "./media.drag";
export { mediaUrl } from "./media.service";
export { getProbe, mediaProbeStore, waitForProbe } from "./media.store";
export { MediaLibrary } from "./components/MediaLibrary";
export type {
  ImportResult,
  MediaDragDetail,
  MediaProbe,
  ProbeStatus,
  ProxyInfo,
  ProxyState,
} from "./media.types";

/** Module definition, loaded by the app shell. */
export const mediaModule: ModuleDefinition = {
  id: "media",
  name: "Media",
  commands: mediaCommands,
  mcpTools: mediaMcpTools,
  async activate({ bus, log }) {
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

    return () => {
      offProject();
      offProbes();
      unlistenProxies();
      unlisten?.();
    };
  },
};

import { getCurrentWebview } from "@tauri-apps/api/webview";
import { SquarePlay } from "lucide-react";
import { defineModule, layoutPanels } from "@/core";
import { elements } from "@/modules/element";
import { projectRef } from "@/modules/project";
import { importMedia, mediaCommands } from "./media.commands";
import { mediaElement } from "./media.element";
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
  requires: ["project", "element"],
  commands: mediaCommands,
  mcpTools: mediaMcpTools,
  async setup({ bus, log, contribute, require, onDispose }) {
    contribute(elements, mediaElement);
    const project = require(projectRef).store;
    const state = createMediaState();
    const { fileDrop, getProbe, setProbe } = state;
    const service = createMediaService(state);
    await service.init();
    // Each cleanup is registered as soon as its resource exists, so a later failure leaks nothing.
    onDispose(await service.listenToProxies());
    const probes = createProbeQueue({ state, mediaUrl: service.mediaUrl });
    onDispose(() => probes.dispose());

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
    onDispose(
      project.subscribe((next, previous) => {
        if (next.mediaOrder !== previous.mediaOrder) probeAll();
      }),
    );
    onDispose(state.probes.subscribe(probeAll));

    // Files dropped onto the window from the OS.
    try {
      const unlistenDrop = await getCurrentWebview().onDragDropEvent((event) => {
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
      onDispose(unlistenDrop);
    } catch (error) {
      log.warn("File drop is unavailable", error);
    }

    contribute(layoutPanels, {
      id: "media.library",
      title: "Library",
      slot: "side",
      icon: SquarePlay,
      component: MediaLibrary,
    });

    return {
      api: {
        probes: state.probes,
        fileDrop,
        getProbe,
        waitForProbe: state.waitForProbe,
        pictureMeta: state.pictureMeta,
        mediaUrl: service.mediaUrl,
      },
    };
  },
});

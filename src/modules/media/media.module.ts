import { getCurrentWebview } from "@tauri-apps/api/webview";
import { Images, SquarePlay } from "lucide-react";
import { appPages, defineModule, layoutPanels } from "@/core";
import { elements } from "@/modules/element";
import { projectRef } from "@/modules/project";
import { mediaBinCommands } from "./media.bin.commands";
import { importMedia, mediaCommands } from "./media.commands";
import { mediaInfoCommands } from "./media.info.commands";
import { frameIndexesAt } from "./logic/animation";
import { mediaElement } from "./media.element";
import { mediaMcpTools } from "./media.mcp";
import { createProbeQueue } from "./media.probe";
import { mediaRef } from "./media.ref";
import { createMediaFiles } from "./media.files";
import { createMediaService, listDisks, readFileFacts, revealFile } from "./media.service";
import { createMediaState } from "./media.store";
import { createLibraryView } from "./media.view.store";
import { MEDIA_PAGE } from "./media.ref";
import { MediaLibrary, MediaPage } from "./ui";

/** Importing files, reading their metadata, proxies, and the media library panel. */
export const mediaModule = defineModule({
  ref: mediaRef,
  name: "Media",
  tier: "core",
  requires: ["project", "element"],
  commands: [...mediaCommands, ...mediaBinCommands, ...mediaInfoCommands],
  mcpTools: mediaMcpTools,
  async setup({ bus, log, contribute, require, onDispose }) {
    contribute(elements, mediaElement);
    const project = require(projectRef).store;
    const state = createMediaState();
    const { fileDrop, getProbe } = state;
    const service = createMediaService(state);
    await service.init();
    // Each cleanup is registered as soon as its resource exists, so a later failure leaks nothing.
    onDispose(await service.listenToProxies());
    const probes = createProbeQueue({
      state,
      mediaUrl: service.mediaUrl,
      frameUrl: service.frameUrl,
    });
    onDispose(() => probes.dispose());

    const files = createMediaFiles({ project, state, probes });
    onDispose(files.follow());

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
    contribute(appPages, {
      id: MEDIA_PAGE,
      label: "Media",
      icon: Images,
      order: 10,
      component: MediaPage,
    });

    return {
      api: {
        probes: state.probes,
        fileDrop,
        getProbe,
        waitForProbe: state.waitForProbe,
        pictureMeta: state.pictureMeta,
        mediaUrl: service.mediaUrl,
        prepareMaster: service.prepareMaster,
        masterUrl: service.masterUrl,
        animation: state.animation,
        imageFrames(id, elapsed, ahead) {
          const animation = state.animation(id);
          if (!animation) return [service.mediaUrl(id)];
          return frameIndexesAt(animation, elapsed, ahead).map((n) => service.frameUrl(id, n));
        },
        restore: files.restore,
        fileFacts: readFileFacts,
        listDisks,
        revealFile,
        view: createLibraryView(),
      },
    };
  },
});

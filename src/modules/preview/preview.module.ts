import { defineModule, keybindings, layoutPanels, type Micros } from "@/core";
import { mediaProbeStore, mediaUrl } from "@/modules/media";
import { projectDuration, projectStore } from "@/modules/project";
import { HtmlMediaEngine } from "./engine/html-media-engine";
import { createPlaybackClock } from "./playback-clock";
import { createPreviewController } from "./preview.controller";
import { previewCommands, seek, togglePlay } from "./preview.commands";
import { previewMcpTools } from "./preview.mcp";
import { previewRef } from "./preview.ref";
import { PreviewPanel } from "./ui";

/** The playback clock, the preview engine and the preview panel. */
export const previewModule = defineModule({
  ref: previewRef,
  name: "Preview",
  tier: "core",
  requires: ["project", "media"],
  commands: previewCommands,
  mcpTools: previewMcpTools,
  setup(ctx) {
    let duration: Micros = projectDuration(projectStore.getState());
    const offDuration = projectStore.subscribe((state, previous) => {
      if (state.clips !== previous.clips) duration = projectDuration(state);
    });
    const clock = createPlaybackClock(() => duration);
    const controller = createPreviewController({
      clock,
      getProject: () => projectStore.getState(),
      getDuration: () => duration,
      subscribeProject: (listener) => projectStore.subscribe(listener),
      subscribeMedia: (listener) => mediaProbeStore.subscribe(listener),
      createEngine: (canvas, onFrameReady) =>
        new HtmlMediaEngine(canvas, { mediaUrl, onFrameReady }),
      requestFrame: (callback) => void requestAnimationFrame(callback),
    });

    ctx.contribute(layoutPanels, {
      id: "preview.panel",
      title: "Preview",
      slot: "main",
      component: PreviewPanel,
    });
    ctx.contribute(
      keybindings,
      {
        id: "preview.toggle-play",
        key: " ",
        resolve: () => ({ command: togglePlay.id, input: {} }),
      },
      {
        id: "preview.seek-start",
        key: "home",
        resolve: () => ({ command: seek.id, input: { time: 0 } }),
      },
    );
    return {
      api: controller,
      dispose() {
        controller.dispose();
        clock.dispose();
        offDuration();
      },
    };
  },
});

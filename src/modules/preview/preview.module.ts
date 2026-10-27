import { defineModule, keybindings, layoutPanels, type Micros } from "@/core";
import { mediaRef } from "@/modules/media";
import { projectDuration, projectRef } from "@/modules/project";
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
    const project = ctx.require(projectRef).store;
    const media = ctx.require(mediaRef);
    let duration: Micros = projectDuration(project.getState());
    ctx.onDispose(
      project.subscribe((state, previous) => {
        if (state.clips !== previous.clips) duration = projectDuration(state);
      }),
    );
    const clock = createPlaybackClock(() => duration);
    const controller = createPreviewController({
      clock,
      getProject: () => project.getState(),
      getDuration: () => duration,
      subscribeProject: (listener) => project.subscribe(listener),
      subscribeMedia: (listener) => media.probes.subscribe(listener),
      createEngine: (canvas, onFrameReady) =>
        new HtmlMediaEngine(canvas, { mediaUrl: media.mediaUrl, onFrameReady }),
      requestFrame: (callback) => void requestAnimationFrame(callback),
    });
    ctx.onDispose(() => {
      controller.dispose();
      clock.dispose();
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
    return { api: controller };
  },
});

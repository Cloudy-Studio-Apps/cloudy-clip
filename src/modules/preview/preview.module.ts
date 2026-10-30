import { defineModule, keybindings, layoutPanels, type Micros } from "@/core";
import { elementRef } from "@/modules/element";
import { fontsRef } from "@/modules/fonts";
import { junctionRef } from "@/modules/junction";
import { mediaRef } from "@/modules/media";
import { projectDuration, projectRef } from "@/modules/project";
import { HtmlMediaEngine } from "./engine/engine.html";
import { createCapture } from "./preview.capture";
import { createPlaybackClock } from "./preview.clock";
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
  requires: ["project", "element", "junction", "media", "fonts"],
  commands: previewCommands,
  mcpTools: previewMcpTools,
  setup(ctx) {
    const project = ctx.require(projectRef).store;
    const media = ctx.require(mediaRef);
    const fonts = ctx.require(fontsRef);
    const elements = ctx.require(elementRef);
    const junctions = ctx.require(junctionRef);
    let duration: Micros = projectDuration(project.getState());
    ctx.onDispose(
      project.subscribe((state, previous) => {
        if (state.clips !== previous.clips) duration = projectDuration(state);
      }),
    );
    const clock = createPlaybackClock(() => duration);
    const engineOptions = { mediaUrl: media.mediaUrl, elements, junctions };
    const controller = createPreviewController({
      clock,
      getProject: () => project.getState(),
      getDuration: () => duration,
      subscribeProject: (listener) => project.subscribe(listener),
      subscribeMedia: (listener) => media.probes.subscribe(listener),
      createEngine: (canvas, onFrameReady) =>
        new HtmlMediaEngine(canvas, {
          ...engineOptions,
          ensureFont: (request) => fonts.ensure(request),
          onFrameReady,
        }),
      requestFrame: (callback) => void requestAnimationFrame(callback),
      capture: createCapture({
        getProject: () => project.getState(),
        ensureFont: (request) => fonts.ensure(request),
        createEngine: (canvas, ensureFont) =>
          new HtmlMediaEngine(canvas, {
            ...engineOptions,
            ensureFont,
            onFrameReady: () => undefined,
            pictureOnly: true,
          }),
      }),
    });
    // A font arriving (or failing) changes how text is drawn and measured.
    ctx.onDispose(fonts.onLoaded(() => controller.redraw()));
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

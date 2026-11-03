import {
  defineModule,
  EDITOR_PAGE,
  appMenuItems,
  appPages,
  keybindings,
  layoutPanels,
  LOCAL_ACTOR,
  pagesRef,
} from "@/core";
import { elementRef } from "@/modules/element";
import { fontsRef } from "@/modules/fonts";
import { junctionRef } from "@/modules/junction";
import { mediaRef } from "@/modules/media";
import { frameDuration, projectRef } from "@/modules/project";
import { HtmlMediaEngine } from "./engine/engine.html";
import { rememberPlayheads } from "./logic/playheads";
import { createCapture, createFrameRenderer } from "./preview.capture";
import { createPlaybackClock } from "./preview.clock";
import { createPreviewController } from "./preview.controller";
import { measureVideoLevels } from "./preview.levels";
import { previewCommands, seek, togglePlay } from "./preview.commands";
import { previewMcpTools } from "./preview.mcp";
import { previewRef } from "./preview.ref";
import type { PreviewCaptureDeps } from "./preview.types";
import { previewOverlays } from "./preview.points";
import { FieldGuide, PreviewPanel } from "./ui";

/** The playback clock, the preview engine and the preview panel. */
export const previewModule = defineModule({
  ref: previewRef,
  name: "Preview",
  tier: "core",
  requires: ["project", "element", "junction", "media", "fonts"],
  commands: previewCommands,
  mcpTools: previewMcpTools,
  setup(ctx) {
    const { store: project, view } = ctx.require(projectRef);
    const media = ctx.require(mediaRef);
    const fonts = ctx.require(fontsRef);
    const elements = ctx.require(elementRef);
    const junctions = ctx.require(junctionRef);
    const openComposition = (actor = LOCAL_ACTOR) => {
      const id = view.openFor(actor);
      return id === null ? null : (project.getState().compositions[id] ?? null);
    };
    const clock = createPlaybackClock(
      () => openComposition()?.duration ?? 0,
      () => {
        const open = openComposition();
        return open ? frameDuration(open.format) : 0;
      },
    );
    const engineOptions = {
      mediaUrl: media.mediaUrl,
      reversedUrl: (id: string) => media.reversedUrl(id, false),
      whenReversed: (id: string, done: () => void) =>
        void media.prepareReversed(id, false).then(done, () => undefined),
      denoisedUrl: media.denoisedUrl,
      fileDuration: (id: string) => media.getProbe(id)?.duration,
      imageFrames: media.imageFrames,
      elements,
      junctions,
    };
    const captureDeps: PreviewCaptureDeps = {
      getProject: () => project.getState(),
      getComposition: (id) => project.getState().compositions[id] ?? null,
      ensureFont: (request) => fonts.ensure(request),
      createEngine: (canvas, ensureFont, options) =>
        new HtmlMediaEngine(canvas, {
          ...engineOptions,
          ...options,
          ensureFont,
          onFrameReady: () => undefined,
          pictureOnly: true,
        }),
    };
    const controller = createPreviewController({
      clock,
      getProject: () => project.getState(),
      getComposition: openComposition,
      getDuration: (actor) => openComposition(actor)?.duration ?? 0,
      subscribeProject(listener) {
        const offProject = project.subscribe(listener);
        const offView = view.store.subscribe(listener);
        return () => {
          offProject();
          offView();
        };
      },
      subscribeMedia: (listener) => media.probes.subscribe(listener),
      createEngine: (canvas, onFrameReady) =>
        new HtmlMediaEngine(canvas, {
          ...engineOptions,
          ensureFont: (request) => fonts.ensure(request),
          onFrameReady,
        }),
      requestFrame: (callback) => void requestAnimationFrame(callback),
      capture: createCapture(captureDeps),
      createRenderer: (options) => createFrameRenderer(captureDeps, options),
      measureVideoLevels,
    });
    // Each composition keeps its playhead and loop: a switch stops playback and goes where this
    // one was.
    const playheads = rememberPlayheads();
    let shown = view.openFor(LOCAL_ACTOR);
    const followOpen = () => {
      const next = view.openFor(LOCAL_ACTOR);
      if (next === shown) return;
      const left = { time: clock.getTime(), loop: clock.getLoop() };
      const { time, loop } = playheads.switchTo(shown, next, left);
      shown = next;
      clock.pause();
      clock.seek(time);
      // One that no longer fits (shortened meanwhile) goes.
      if (!clock.setLoop(loop)) clock.setLoop(null);
    };
    // Clips removed or trimmed: the playhead stays inside, and a loop past the end is clamped
    // (or goes when under a frame is left), with or without a preview on screen.
    const keepInside = () => {
      const duration = openComposition()?.duration ?? 0;
      if (clock.getTime() > duration) clock.seek(duration);
      const loop = clock.getLoop();
      if (loop && loop.to > duration && !clock.setLoop(loop)) clock.setLoop(null);
    };
    const follow = () => {
      followOpen();
      keepInside();
    };
    ctx.onDispose(view.store.subscribe(follow));
    ctx.onDispose(project.subscribe(follow));
    // A font arriving (or failing) changes how text is drawn and measured.
    ctx.onDispose(fonts.onLoaded(() => controller.redraw()));
    // Another page covers the preview, so nothing should keep playing behind it, unless the page
    // asks to keep playback going.
    ctx.onDispose(
      ctx.require(pagesRef).store.subscribe(({ active }) => {
        if (active === EDITOR_PAGE) return;
        const page = ctx.points.get(appPages).find((p) => p.id === active);
        if (!page?.keepsPlayback) clock.pause();
      }),
    );
    ctx.onDispose(() => {
      controller.dispose();
      clock.dispose();
    });

    ctx.contribute(previewOverlays, { id: "preview.fieldGuide", component: FieldGuide });
    ctx.contribute(
      appMenuItems,
      {
        id: "preview.play",
        menu: "Playback",
        label: "Play or pause",
        order: 10,
        keybinding: "preview.toggle-play",
      },
      {
        id: "preview.start",
        menu: "Playback",
        label: "Back to start",
        order: 20,
        keybinding: "preview.seek-start",
      },
    );
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

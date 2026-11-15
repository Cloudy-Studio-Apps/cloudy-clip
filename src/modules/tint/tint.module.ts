import { Palette } from "lucide-react";
import {
  appPages,
  defineModule,
  followPageLeave,
  keybindings,
  pagesRef,
  topBarItems,
} from "@/core";
import { mediaRef } from "@/modules/media";
import { pictureFilters, previewRef } from "@/modules/preview";
import { projectRef } from "@/modules/project";
import { relinkKinds, workspaceRef } from "@/modules/workspace";
import { followCurrent, createCurrent } from "./tint.current";
import { tintCommands } from "./tint.commands";
import { createTintFilter, redrawOnShow } from "./tint.filter";
import { createLutFiles } from "./tint.luts";
import { createPicker } from "./tint.pick";
import { BUILTIN_LOOKS } from "./tint.looks";
import { tintLooks } from "./tint.points";
import { createThumbs } from "./tint.thumb";
import { tintKeys } from "./tint.keys";
import { tintMcpTools } from "./tint.mcp";
import { TINT_PAGE, tintRef } from "./tint.ref";
import { createTintLive, createTintView } from "./tint.store";
import { clearViewing, tintViewCommands } from "./tint.view.commands";
import { LutRelinkRows, SealSwitch, TintPage } from "./ui";

/** The Tint page (its frame is real; the grade panels are still demo data) and the filter that draws clip grades. */
export const tintModule = defineModule({
  ref: tintRef,
  name: "Tint",
  tier: "feature",
  requires: ["project", "preview", "timeline", "media", "workspace"],
  commands: [...tintCommands, ...tintViewCommands],
  mcpTools: tintMcpTools,
  setup(ctx) {
    const { bus, contribute, onDispose, points } = ctx;
    const preview = ctx.require(previewRef);
    const view = createTintView();
    const live = createTintLive(() => preview.redraw());
    const holder = createCurrent();
    onDispose(
      followCurrent({ project: ctx.require(projectRef), clock: preview.playback, view, holder }),
    );
    onDispose(
      followPageLeave(ctx.require(pagesRef).store, TINT_PAGE, () => void bus.run(clearViewing, {})),
    );
    const workspace = ctx.require(workspaceRef);
    const { files: luts, stop } = createLutFiles(
      ctx.require(projectRef),
      () => preview.redraw(),
      () => workspace.ui.setState({ relink: true }),
    );
    onDispose(stop);
    const project = ctx.require(projectRef);
    const thumbs = createThumbs(
      (time, compositionId, options) => preview.captureAt(time, compositionId, options),
      (grade) =>
        Object.values(grade.nodes).some((node) => {
          const lut =
            node.kind === "correct"
              ? project.store.getState().luts?.[node.lut?.id ?? ""]
              : undefined;
          return lut !== undefined && luts.file(lut).status === "loading";
        }),
    );
    const picker = createPicker(ctx.require(projectRef), preview, ctx.require(mediaRef), luts);
    onDispose(redrawOnShow(view, () => preview.redraw()));
    contribute(pictureFilters, createTintFilter(live, view, ctx.require(mediaRef), luts));
    contribute(relinkKinds, { id: "tint.luts", order: 10, component: LutRelinkRows });
    contribute(appPages, {
      id: TINT_PAGE,
      label: "Tint",
      icon: Palette,
      order: 25,
      component: TintPage,
      keepsPlayback: true,
    });
    contribute(topBarItems, { id: "tint.sealSwitch", slot: "right", component: SealSwitch });
    contribute(tintLooks, ...BUILTIN_LOOKS);
    contribute(keybindings, ...tintKeys(ctx));
    return {
      api: {
        view,
        live,
        luts,
        get available() {
          return preview.gpuAvailable();
        },
        current: holder.current,
        onCurrent: holder.onCurrent,
        viewedAt: holder.viewedAt,
        looks: {
          find: (id) => points.find(tintLooks, id),
          list: () => points.get(tintLooks),
        },
        thumb: thumbs.thumb,
        lookThumb: thumbs.lookThumb,
        pickColor: picker.pickColor,
      },
    };
  },
});

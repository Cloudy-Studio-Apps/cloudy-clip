import { Palette } from "lucide-react";
import {
  appPages,
  defineModule,
  followPageLeave,
  keybindings,
  pagesRef,
  topBarItems,
} from "@/core";
import { pictureFilters, previewRef } from "@/modules/preview";
import { projectRef } from "@/modules/project";
import { followCurrent, createCurrent } from "./tint.current";
import { tintCommands } from "./tint.commands";
import { createTintFilter } from "./tint.filter";
import { createThumbs } from "./tint.thumb";
import { tintKeys } from "./tint.keys";
import { tintMcpTools } from "./tint.mcp";
import { TINT_PAGE, tintRef } from "./tint.ref";
import { createTintLive, createTintView } from "./tint.store";
import { clearViewing, tintViewCommands } from "./tint.view.commands";
import { SealSwitch, TintPage } from "./ui";

/** The Tint page (its frame is real; the grade panels are still demo data) and the filter that draws clip grades. */
export const tintModule = defineModule({
  ref: tintRef,
  name: "Tint",
  tier: "feature",
  requires: ["project", "preview", "timeline", "media"],
  commands: [...tintCommands, ...tintViewCommands],
  mcpTools: tintMcpTools,
  setup(ctx) {
    const { bus, contribute, onDispose } = ctx;
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
    const thumbs = createThumbs((time, compositionId, options) =>
      preview.captureAt(time, compositionId, options),
    );
    contribute(pictureFilters, createTintFilter(live));
    contribute(appPages, {
      id: TINT_PAGE,
      label: "Tint",
      icon: Palette,
      order: 25,
      component: TintPage,
      keepsPlayback: true,
    });
    contribute(topBarItems, { id: "tint.sealSwitch", slot: "right", component: SealSwitch });
    contribute(keybindings, ...tintKeys(ctx));
    return {
      api: {
        view,
        live,
        get available() {
          return preview.gpuAvailable();
        },
        current: holder.current,
        onCurrent: holder.onCurrent,
        viewedAt: holder.viewedAt,
        thumb: thumbs.thumb,
      },
    };
  },
});

import { Palette } from "lucide-react";
import { appPages, defineModule, keybindings, topBarItems } from "@/core";
import { pictureFilters, previewRef } from "@/modules/preview";
import { projectRef } from "@/modules/project";
import { followCurrent, createCurrent } from "./tint.current";
import { tintCommands } from "./tint.commands";
import { createTintFilter } from "./tint.filter";
import { tintKeys } from "./tint.keys";
import { tintMcpTools } from "./tint.mcp";
import { TINT_PAGE, tintRef } from "./tint.ref";
import { createTintLive, createTintView } from "./tint.store";
import { tintViewCommands } from "./tint.view.commands";
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
    const { contribute, onDispose } = ctx;
    const preview = ctx.require(previewRef);
    const view = createTintView();
    const live = createTintLive(() => preview.redraw());
    const holder = createCurrent();
    onDispose(
      followCurrent({ project: ctx.require(projectRef), clock: preview.playback, view, holder }),
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
      },
    };
  },
});

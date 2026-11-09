import { Palette } from "lucide-react";
import { appPages, defineModule, topBarItems } from "@/core";
import { pictureFilters, previewRef } from "@/modules/preview";
import { createTintFilter } from "./tint.filter";
import { TINT_PAGE, tintRef } from "./tint.ref";
import { createTintLive, createTintView } from "./tint.store";
import { SealSwitch, TintPage } from "./ui";

/** The Tint page (laid out with demo data for now) and the filter that draws clip grades. */
export const tintModule = defineModule({
  ref: tintRef,
  name: "Tint",
  tier: "feature",
  requires: ["project", "preview"],
  setup(ctx) {
    const { contribute } = ctx;
    const preview = ctx.require(previewRef);
    const view = createTintView();
    const live = createTintLive(() => preview.redraw());
    contribute(pictureFilters, createTintFilter(live));
    contribute(appPages, {
      id: TINT_PAGE,
      label: "Tint",
      icon: Palette,
      order: 25,
      component: TintPage,
    });
    contribute(topBarItems, { id: "tint.sealSwitch", slot: "right", component: SealSwitch });
    return { api: { view, live } };
  },
});

import { Palette } from "lucide-react";
import { appPages, defineModule, topBarItems } from "@/core";
import { TINT_PAGE, tintRef } from "./tint.ref";
import { createTintView } from "./tint.store";
import { SealSwitch, TintPage } from "./ui";

/** The Tint page, laid out with demo data: nothing on it edits the project yet. */
export const tintModule = defineModule({
  ref: tintRef,
  name: "Tint",
  tier: "feature",
  setup({ contribute }) {
    const view = createTintView();
    contribute(appPages, {
      id: TINT_PAGE,
      label: "Tint",
      icon: Palette,
      order: 25,
      component: TintPage,
    });
    contribute(topBarItems, { id: "tint.sealSwitch", slot: "right", component: SealSwitch });
    return { api: { view } };
  },
});

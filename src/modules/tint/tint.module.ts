import { Palette } from "lucide-react";
import { appPages, defineModule } from "@/core";
import { tintRef } from "./tint.ref";
import { TintPage } from "./ui";

/** The Tint page, empty for now. */
export const tintModule = defineModule({
  ref: tintRef,
  name: "Tint",
  tier: "feature",
  setup({ contribute }) {
    contribute(appPages, {
      id: "tint.page",
      label: "Tint",
      icon: Palette,
      order: 25,
      component: TintPage,
    });
    return { api: {} };
  },
});

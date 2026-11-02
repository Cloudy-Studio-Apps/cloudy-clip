import { AudioLines } from "lucide-react";
import { appPages, defineModule } from "@/core";
import { soundRef } from "./sound.ref";
import { SoundPage } from "./ui";

/** The Sound page, empty for now. */
export const soundModule = defineModule({
  ref: soundRef,
  name: "Sound",
  tier: "feature",
  setup({ contribute }) {
    contribute(appPages, {
      id: "sound.page",
      label: "Sound",
      icon: AudioLines,
      order: 30,
      component: SoundPage,
    });
    return { api: {} };
  },
});

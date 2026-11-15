import { useStore } from "zustand";
import { useModule } from "@/core";
import { soundRef } from "../../sound.ref";
import { StripSilenceDialog } from "./StripSilenceDialog";

/** Shows the Strip silence dialog while it is open (from the Sound page or a clip's menu). */
export function StripSilenceHost() {
  const target = useStore(useModule(soundRef).view, (s) => s.silence);
  return target ? <StripSilenceDialog target={target} /> : null;
}

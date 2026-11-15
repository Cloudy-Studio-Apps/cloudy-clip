import { useStore } from "zustand";
import { useModule } from "@/core";
import { soundRef } from "../../sound.ref";
import { MatchLevelDialog } from "./MatchLevelDialog";

/** Shows the Match level dialog while it is open (from the Sound page's quick tools). */
export function MatchLevelHost() {
  const target = useStore(useModule(soundRef).view, (s) => s.match);
  return target ? <MatchLevelDialog target={target} /> : null;
}

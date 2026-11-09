import type { Ref } from "react";
import type { PhaseMeterHandle } from "../../sound.types";
import { PanelCard } from "../card";
import { PhaseMeter } from "./PhaseMeter";

/** "Stereo phase": Correlation and Mono safe of the master, from the Loudness tab's feed. */
export function PhaseCard({ ref }: { ref?: Ref<PhaseMeterHandle> }) {
  return (
    <PanelCard title="Stereo phase">
      <PhaseMeter ref={ref} />
    </PanelCard>
  );
}

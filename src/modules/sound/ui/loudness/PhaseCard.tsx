import { PanelCard, PanelValue } from "../card";

/**
 * "Stereo phase": Correlation and Mono safe, both `—` until the phase is measured
 * (`loudness.phase`, stage 5).
 */
export function PhaseCard() {
  return (
    <PanelCard title="Stereo phase">
      <PanelValue label="Correlation" soon="loudness.phase" />
      <PanelValue label="Mono safe" soon="loudness.phase" />
    </PanelCard>
  );
}

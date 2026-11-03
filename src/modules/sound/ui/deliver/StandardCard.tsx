import { Button, cn } from "@/ui";
import { PanelCard, PanelValue } from "../card";
import { soon } from "../soon";

/**
 * "Delivery standard": the platform preset, its loudness and its peak limit, all `—` until stage 5
 * checks each figure against the platform (`deliver.standard`), and "Analyze whole mix"
 * (`deliver.analyze`), coming soon too.
 */
export function StandardCard() {
  const analyze = soon("deliver.analyze");
  return (
    <PanelCard title="Delivery standard" className="row-span-2">
      <PanelValue label="Preset" pick soon="deliver.standard" />
      <PanelValue label="Loudness" unit="LUFS" soon="deliver.standard" />
      <PanelValue label="Peak limit" unit="dBTP" soon="deliver.standard" />
      <Button variant="primary" {...analyze} className={cn("mt-1.5 w-full", analyze.className)}>
        Analyze whole mix
      </Button>
    </PanelCard>
  );
}

import { PanelCard } from "../card";
import { soon } from "../soon";
import { CheckRow } from "./CheckRow";

/**
 * "Stems": what the export writes besides the mix, unticked, since nothing is chosen yet
 * (`deliver.stems`, stages 4 and 5). A stem per group comes with the groups; this project has none,
 * so none is listed.
 */
export function StemsCard() {
  return (
    <PanelCard title="Stems" className="row-span-2">
      <CheckRow label="Full mix" checked={false} {...soon("deliver.stems")} />
      <CheckRow label="Match target on export" checked={false} {...soon("deliver.stems")} />
    </PanelCard>
  );
}

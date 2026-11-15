import { FormatCard } from "./FormatCard";
import { ProblemsCard } from "./ProblemsCard";
import { StandardCard } from "./StandardCard";
import { StemsCard } from "./StemsCard";

/**
 * What the mix is delivered as: the delivery standard (with Analyze, Match target and the result),
 * the problems the analysis finds, the audio format and the stems, four cards two rows tall in
 * 216 px columns. Format and stems are the Export page's own settings, shown and edited here too.
 */
export function DeliverTab() {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(216px,1fr))] content-start">
      <StandardCard />
      <ProblemsCard />
      <FormatCard />
      <StemsCard />
    </div>
  );
}

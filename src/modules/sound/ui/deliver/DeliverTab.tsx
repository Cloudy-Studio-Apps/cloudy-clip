import { FormatCard } from "./FormatCard";
import { ProblemsCard } from "./ProblemsCard";
import { StandardCard } from "./StandardCard";
import { StemsCard } from "./StemsCard";

/**
 * What the mix is delivered as: the delivery standard, the problems an analysis finds, the audio
 * format and the stems, four cards two rows tall in 216 px columns. All of it comes in stages 4
 * and 5: the cards show the prototype's shape with `—`, an honest empty line and nothing ticked,
 * never example figures (Ruling 1 of the layout plan).
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

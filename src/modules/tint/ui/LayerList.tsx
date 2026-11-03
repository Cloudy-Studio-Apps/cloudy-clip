import { DEMO_STACK } from "./demo/demo.grade";
import type { DemoItem } from "./demo/demo.types";
import { AddMenu } from "./AddMenu";
import { FlowLabel } from "./FlowLabel";
import { GroupRow } from "./GroupRow";
import { LayerRow } from "./LayerRow";
import { SealedCard } from "./SealedCard";

function Item({ item }: { item: DemoItem }) {
  if (item.type === "layer") return <LayerRow layer={item} />;
  if (item.type === "group") return <GroupRow group={item} />;
  return <SealedCard card={item} />;
}

/** Baby Seal: the grade as layers, top (nearest the picture coming in) to bottom. */
export function LayerList() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-auto px-3 py-2.5">
        <FlowLabel>Picture in · S-Log3 → Rec.709</FlowLabel>
        {DEMO_STACK.map((item) => (
          <Item key={item.id} item={item} />
        ))}
        <FlowLabel>Out to the timeline</FlowLabel>
      </div>
      <div className="flex shrink-0 items-center gap-2 border-t border-border px-3 py-2.5">
        <AddMenu />
      </div>
    </div>
  );
}

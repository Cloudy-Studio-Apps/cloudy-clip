import type { StackItem } from "../tint.types";
import { GroupRow } from "./GroupRow";
import { LayerRow } from "./LayerRow";
import { SealedCard } from "./SealedCard";

/** A list of the stack's items: layers, groups and sealed cards. */
export function StackItems({
  items,
  nested = false,
}: {
  items: readonly StackItem[];
  nested?: boolean;
}) {
  return (
    <>
      {items.map((item) =>
        item.type === "layer" ? (
          <LayerRow key={item.id} id={item.id} nested={nested} />
        ) : item.type === "group" ? (
          <GroupRow key={item.id} group={item} />
        ) : (
          <SealedCard key={item.id} card={item} />
        ),
      )}
    </>
  );
}

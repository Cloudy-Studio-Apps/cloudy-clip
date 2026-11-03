import { PanelCard } from "../card";

/**
 * "Problems": what an analysis of the whole mix finds. Nothing has been analyzed (stage 5), so it
 * has no count and no rows, only the line that says how to get them.
 */
export function ProblemsCard() {
  return (
    <PanelCard title="Problems" className="row-span-2">
      <p className="text-sm text-subtle-foreground">
        Analyze the mix to find peaks over the limit and clipping.
      </p>
    </PanelCard>
  );
}

import { useMemo } from "react";
import { formatDb } from "@/modules/project";
import { groupProblems } from "../../logic/problems";
import { PanelCard } from "../card";
import { useDeliver } from "./deliver.hook";
import { ProblemList } from "./ProblemList";

/**
 * "Problems": what the analysis of the whole mix found, one row per spot where the true peak goes
 * over the peak limit or the mix clips (a clipped stretch always lies in a peak stretch, so they
 * are one row showing the worst kind). Click one to go there. Before an analysis it says how to
 * get the list; after one, a mix with nothing wrong says that.
 */
export function ProblemsCard() {
  const { stored, stale, delivery } = useDeliver();
  const spots = useMemo(() => groupProblems(stored?.result.problems ?? []), [stored]);
  return (
    <PanelCard
      title="Problems"
      className="row-span-2"
      actions={
        stored && (
          <span
            className={`font-mono text-base font-bold ${spots.length > 0 ? "text-mark" : "text-on"}`}
          >
            {spots.length}
          </span>
        )
      }
    >
      {!stored && (
        <p className="text-sm text-subtle-foreground">
          Analyze the mix to find peaks over the limit and clipping.
        </p>
      )}
      {stored && spots.length === 0 && (
        <p className="text-sm text-subtle-foreground">
          No peak over {formatDb(stored.peakDbtp)} dBTP and no clipping
          {stale ? ", before your last edit." : "."}
        </p>
      )}
      {spots.length > 0 && <ProblemList spots={spots} stale={stale} />}
      {spots.length > 0 && (
        <p className="mt-1.5 text-sm text-subtle-foreground">
          {stale
            ? "From before your last edit: analyze again."
            : `Click one to jump there. Limit ${formatDb(delivery.peakDbtp)} dBTP.`}
        </p>
      )}
    </PanelCard>
  );
}

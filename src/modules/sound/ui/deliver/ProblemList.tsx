import { useKernel } from "@/core";
import { seek } from "@/modules/preview";
import { formatDb } from "@/modules/project";
import { cn } from "@/ui";
import { spotTime } from "../../logic/problems";
import type { MixProblem } from "../../sound.types";

/**
 * The spots of an analysis, one row each, earliest first: the time, the worst kind that happens
 * there (peak over the limit, clipped) and its level. A click seeks the user's playhead there: it
 * runs `seek` as the user, so an agent's clock never moves. `stale`: the mix changed since, so the
 * rows are dimmed.
 */
export function ProblemList({ spots, stale }: { spots: readonly MixProblem[]; stale: boolean }) {
  const { bus } = useKernel();
  return (
    <ul className={cn("max-h-44 overflow-y-auto", stale && "opacity-60")}>
      {spots.map((spot) => (
        <li key={`${spot.at}-${spot.kind}`}>
          <button
            type="button"
            title={`Go to ${spotTime(spot.at)}`}
            onClick={() => void bus.run(seek, { time: spot.at })}
            className="flex min-h-[25px] w-full items-center justify-between gap-2 text-left text-muted-foreground hover:text-foreground"
          >
            <span>
              <span className="font-mono">{spotTime(spot.at)}</span>{" "}
              {spot.kind === "clipped" ? "Clipped" : "Peak high"}
            </span>
            <span className="border-b border-mark font-mono text-base font-bold text-mark">
              {formatDb(spot.level)}
              <span className="ml-0.5 text-xs font-normal text-subtle-foreground">
                {spot.kind === "clipped" ? "dBFS" : "dBTP"}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

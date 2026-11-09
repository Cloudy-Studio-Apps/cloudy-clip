import { useState } from "react";
import { useKernel } from "@/core";
import { seek } from "@/modules/preview";
import { formatDb } from "@/modules/project";
import { cn } from "@/ui";
import { spotTime } from "../../logic/problems";
import type { MixProblem } from "../../sound.types";

/** A row's height and how many show at once, px and rows. */
const ROW = 25;
const SHOWN = 7;
/** Rows drawn beyond the visible ones, each side. */
const EXTRA = 3;

/**
 * The spots of an analysis, one row each, earliest first: the time, the worst kind that happens
 * there (peak over the limit, clipped) and its level. Windowed: rows have one height, so only the
 * visible ones and a few either side are in the DOM, however many spots there are. A click seeks
 * the user's playhead there: it runs `seek` as the user, so an agent's clock never moves.
 * `stale`: the mix changed since, so the rows are dimmed.
 */
export function ProblemList({ spots, stale }: { spots: readonly MixProblem[]; stale: boolean }) {
  const { bus } = useKernel();
  const [top, setTop] = useState(0);
  const first = Math.max(0, top - EXTRA);
  const last = Math.min(spots.length, top + SHOWN + EXTRA);
  return (
    <ul
      className={cn("overflow-y-auto", stale && "opacity-60")}
      style={{ maxHeight: SHOWN * ROW }}
      onScroll={(event) => setTop(Math.floor(event.currentTarget.scrollTop / ROW))}
    >
      <li aria-hidden style={{ height: first * ROW }} />
      {spots.slice(first, last).map((spot) => (
        <li key={`${spot.at}-${spot.kind}`} style={{ height: ROW }}>
          <button
            type="button"
            title={`Go to ${spotTime(spot.at)}`}
            onClick={() => void bus.run(seek, { time: spot.at })}
            className="flex h-full w-full items-center justify-between gap-2 text-left text-muted-foreground hover:text-foreground"
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
      <li aria-hidden style={{ height: (spots.length - last) * ROW }} />
    </ul>
  );
}

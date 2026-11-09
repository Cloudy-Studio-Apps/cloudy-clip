import { useKernel } from "@/core";
import { formatDb } from "@/modules/project";
import { Button, ProgressBar } from "@/ui";
import { formatTrim } from "../../logic/fader";
import { cancelAnalysis, startMatch } from "../../sound.delivery.commands";
import type { DeliverView, MatchRun } from "../../sound.delivery.types";
import { report } from "../report";

const STEPS: Record<MatchRun["step"], string> = {
  measuring: "Measuring the mix",
  correcting: "Checking the change",
  landing: "Measuring the result",
};

/**
 * "Match target": brings the mix to the delivery target through Master's trim, with a limiter at
 * the peak limit; one undo step. While it works it shows its step and progress, with Cancel (the
 * project is touched only at the end); after it, what the trim became and where the mix landed,
 * for as long as the document is as it left it.
 */
export function MatchRow({ view }: { view: DeliverView }) {
  const { bus } = useKernel();
  const { compositionId, running, matching, matched, matchFailed, stale } = view;
  const id = compositionId ? { compositionId } : {};
  if (matching) {
    return (
      <div className="mt-1.5 flex flex-col gap-1.5">
        <ProgressBar value={matching.progress} />
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {STEPS[matching.step]}… {Math.round(matching.progress * 100)}%
          </span>
          <Button size="sm" onClick={() => void bus.run(cancelAnalysis, id).then(report)}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }
  return (
    <>
      <Button
        className="mt-1.5 w-full"
        disabled={!compositionId || Boolean(running)}
        title="Moves Master's trim to the target and guards the peak limit with a limiter."
        onClick={() => void bus.run(startMatch, id).then(report)}
      >
        Match target
      </Button>
      {matchFailed && <p className="mt-1 text-sm text-mark">{matchFailed}</p>}
      {matched && !stale && !matchFailed && (
        <p className="mt-1 text-sm text-subtle-foreground">
          Master trim {formatTrim(matched.trimDb)}
          {matched.landed?.integrated != null &&
            `, now ${formatDb(matched.landed.integrated)} LUFS`}
          {matched.limiterAdded && ", limiter added"}
          {matched.limiterSwitched &&
            (matched.limiterMoved
              ? ", limiter switched on and moved to the end of Master's chain"
              : ", limiter switched on")}
          .{matched.clamped && " The trim's range kept the mix from the target."}
        </p>
      )}
      {matched && !stale && !matchFailed && matched.peakOver && (
        <p className="mt-1 text-sm text-mark">
          Still {matched.peakOver.overDb.toFixed(1)} dB over the peak limit.{" "}
          {matched.peakOver.userLimiter
            ? "Master's limiter is your own and its ceiling is above the limit: lower it."
            : "Peaks between samples got past the limiter: lower its ceiling or the Master trim."}
        </p>
      )}
    </>
  );
}

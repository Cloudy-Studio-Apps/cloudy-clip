import { useKernel } from "@/core";
import { Button, ProgressBar } from "@/ui";
import { analyzeMix, cancelAnalysis } from "../../sound.delivery.commands";
import type { DeliverView } from "../../sound.types";
import { report } from "../report";

/**
 * "Analyze whole mix": measures the mix without playing it, in the background. While it runs, a
 * progress bar and Cancel replace the button; a failure says why. Analyzing is off while Match
 * target works (it measures too).
 */
export function AnalyzeRow({ view }: { view: DeliverView }) {
  const { bus } = useKernel();
  const { compositionId, running, failed, matching, stored } = view;
  const id = compositionId ? { compositionId } : {};
  if (running && !matching) {
    return (
      <div className="mt-1 flex flex-col gap-1.5">
        <ProgressBar value={running.progress} />
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Analyzing… {Math.round(running.progress * 100)}%</span>
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
        variant="primary"
        className="mt-1.5 w-full"
        disabled={!compositionId || Boolean(matching)}
        onClick={() => void bus.run(analyzeMix, id).then(report)}
      >
        {stored ? "Analyze again" : "Analyze whole mix"}
      </Button>
      {failed && <p className="mt-1 text-sm text-mark">{failed}</p>}
    </>
  );
}

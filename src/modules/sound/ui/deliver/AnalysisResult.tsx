import { formatDb } from "@/modules/project";
import { cn } from "@/ui";
import { ON_TARGET_LU, verdictOf } from "../../logic/verdict";
import { PanelValue } from "../card";
import type { DeliverView } from "../../sound.types";

/** The time an analysis ended, for people: `14:32`. */
const clock = (at: number) =>
  new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/**
 * What the last analysis found, against the target: integrated loudness (blue when within 1 LU of
 * the target, red otherwise), true peak (red when over the limit) and range, and under them which
 * state of the mix it measured. After any edit the figures stay but say they are stale.
 */
export function AnalysisResult({ view }: { view: DeliverView }) {
  const { stored, stale, delivery } = view;
  if (!stored) return null;
  const { integrated, truePeak, range } = stored.result;
  const { loudnessDiff, peakMargin } = verdictOf(stored.result, delivery);
  return (
    <div className={cn("mt-1.5", stale && "opacity-60")}>
      {integrated === null ? (
        <p className="text-sm text-subtle-foreground">The mix is silent.</p>
      ) : (
        <>
          <PanelValue
            label="Integrated"
            value={formatDb(integrated)}
            unit="LUFS"
            tone={loudnessDiff !== null && Math.abs(loudnessDiff) <= ON_TARGET_LU ? "on" : "mark"}
          />
          <PanelValue
            label="True peak"
            value={truePeak === null ? "−∞" : formatDb(truePeak)}
            unit="dBTP"
            tone={peakMargin !== null && peakMargin < 0 ? "mark" : "on"}
          />
          <PanelValue label="Range" value={range.toFixed(1)} unit="LU" />
        </>
      )}
      <p className="mt-1 text-sm text-subtle-foreground">
        {stale
          ? `Stale: this measured the mix as it was at ${clock(stored.at)}, before your last edit.`
          : `Measured the mix as it is, at ${clock(stored.at)}.`}
      </p>
    </div>
  );
}

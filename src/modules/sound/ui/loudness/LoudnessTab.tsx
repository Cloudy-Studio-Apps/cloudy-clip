import { RotateCcw } from "lucide-react";
import { useCallback, useRef } from "react";
import { useModule } from "@/core";
import { previewRef, type LoudnessReading } from "@/modules/preview";
import { formatDb } from "@/modules/project";
import { Button } from "@/ui";
import type { LoudnessHistoryHandle } from "../../sound.types";
import { LoudnessHistory } from "./LoudnessHistory";
import { useLoudnessFeed } from "./loudness.hook";
import { PanelCard } from "../card";

/** The readouts, in the order they are drawn, with their units. */
const ROWS = [
  { key: "momentary", label: "Momentary", unit: "LUFS" },
  { key: "shortTerm", label: "Short term", unit: "LUFS" },
  { key: "truePeak", label: "True peak", unit: "dBTP" },
  { key: "range", label: "Range", unit: "LU" },
] as const;

/** A value of a reading for people; a dash before anything was measured. */
function text(reading: LoudnessReading | null, key: keyof LoudnessReading): string {
  if (!reading) return "—";
  return key === "range" ? reading.range.toFixed(1) : formatDb(reading[key]);
}

/**
 * Live loudness of the master, as BS.1770 measures it while the timeline plays: integrated over
 * all the playing since Reset, momentary, short term, true peak and range, and the short-term history
 * of the last 60 s. One feed (`useLoudnessFeed`, 10 Hz while playing, nothing while paused) writes
 * the numbers through the DOM and feeds the history; stopping keeps them. `shown`: whether the tab
 * is the one showing, so the graph draws only then.
 */
export function LoudnessTab({ shown }: { shown: boolean }) {
  const preview = useModule(previewRef);
  const integratedRef = useRef<HTMLSpanElement>(null);
  const valueRefs = useRef<Partial<Record<keyof LoudnessReading, HTMLSpanElement | null>>>({});
  const historyRef = useRef<LoudnessHistoryHandle>(null);

  const write = useCallback((reading: LoudnessReading | null) => {
    if (integratedRef.current) integratedRef.current.textContent = text(reading, "integrated");
    for (const { key } of ROWS) {
      const cell = valueRefs.current[key];
      if (cell) cell.textContent = text(reading, key);
    }
  }, []);
  const onReading = useCallback(
    (reading: LoudnessReading | null, playing: boolean) => {
      write(reading);
      if (playing) historyRef.current?.push(reading?.shortTerm ?? -Infinity);
    },
    [write],
  );
  useLoudnessFeed(onReading);

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] content-start">
      <PanelCard
        title="Program loudness"
        className="row-span-2"
        actions={
          <Button
            size="sm"
            onClick={() => {
              preview.sound.resetLoudness();
              write(preview.sound.loudness());
              historyRef.current?.clear();
            }}
          >
            <RotateCcw />
            Reset
          </Button>
        }
      >
        <div className="mb-1 font-mono text-md font-bold leading-none">
          <span ref={integratedRef}>—</span>
          <span className="ml-1 text-sm font-normal text-subtle-foreground">LUFS</span>
        </div>
        <p className="mb-1 text-sm text-subtle-foreground">Integrated, since Reset.</p>
        {ROWS.map(({ key, label, unit }) => (
          <div
            key={key}
            className="flex min-h-[25px] items-center justify-between gap-2 text-muted-foreground"
          >
            <span>{label}</span>
            <span className="min-w-[58px] whitespace-nowrap border-b border-border-strong py-px text-right font-mono text-base font-bold text-foreground">
              <span
                ref={(cell) => {
                  valueRefs.current[key] = cell;
                }}
              >
                —
              </span>
              <span className="ml-0.5 text-xs font-normal text-subtle-foreground">{unit}</span>
            </span>
          </div>
        ))}
      </PanelCard>
      <PanelCard title="Loudness over time">
        <LoudnessHistory ref={historyRef} shown={shown} />
      </PanelCard>
    </div>
  );
}

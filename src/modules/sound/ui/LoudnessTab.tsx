import { RotateCcw } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useModule } from "@/core";
import { previewRef, type LoudnessReading } from "@/modules/preview";
import { Button } from "@/ui";
import { formatDb } from "../logic/meter";
import { LoudnessHistory } from "./LoudnessHistory";
import { useLoudnessFeed } from "./loudness.hook";
import { PanelCard } from "./PanelCard";

/** The readouts, in the order they are drawn, with their units. */
const ROWS = [
  { key: "momentary", label: "Momentary", unit: "LUFS" },
  { key: "shortTerm", label: "Short term", unit: "LUFS" },
  { key: "truePeak", label: "True peak", unit: "dBTP" },
  { key: "range", label: "Range", unit: "LU" },
] as const;

/** A value of a reading for people; a dash before anything was measured. */
function shown(reading: LoudnessReading | null, key: keyof LoudnessReading): string {
  if (!reading) return "—";
  return key === "range" ? reading.range.toFixed(1) : formatDb(reading[key]);
}

/**
 * Live loudness of the master, as BS.1770 measures it while the timeline plays: integrated since
 * play started (or Reset), momentary, short term, true peak and range, and the short-term history
 * of the last 60 s. The numbers are written through the DOM at 10 Hz; stopping keeps them.
 */
export function LoudnessTab() {
  const preview = useModule(previewRef);
  const integratedRef = useRef<HTMLSpanElement>(null);
  const valueRefs = useRef<Partial<Record<keyof LoudnessReading, HTMLSpanElement | null>>>({});
  // Bumped by Reset: the history remounts empty.
  const [resets, setResets] = useState(0);

  const onReading = useCallback((reading: LoudnessReading | null) => {
    if (integratedRef.current) integratedRef.current.textContent = shown(reading, "integrated");
    for (const { key } of ROWS) {
      const cell = valueRefs.current[key];
      if (cell) cell.textContent = shown(reading, key);
    }
  }, []);
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
              setResets((n) => n + 1);
            }}
          >
            <RotateCcw />
            Reset
          </Button>
        }
      >
        <div className="mb-1 font-mono text-display font-bold leading-none">
          <span ref={integratedRef}>—</span>
          <span className="ml-1 text-sm font-normal text-subtle-foreground">LUFS</span>
        </div>
        <p className="mb-1 text-sm text-subtle-foreground">Integrated, since play started.</p>
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
        <LoudnessHistory key={resets} />
      </PanelCard>
    </div>
  );
}

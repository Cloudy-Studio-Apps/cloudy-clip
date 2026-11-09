import { frequencyX } from "../../logic/spectrum";
import { PanelCard } from "../card";
import { SPECTRUM_LINES, SpectrumGraph } from "./SpectrumGraph";

/** The label of a line of the grid: `100`, `1k`, `10k`. */
const label = (hz: number) => (hz >= 1000 ? `${hz / 1000}k` : String(hz));

/** "Frequency spectrum": how loud each frequency of the master is while the timeline plays. */
export function SpectrumCard({ shown }: { shown: boolean }) {
  return (
    <PanelCard title="Frequency spectrum">
      <SpectrumGraph shown={shown} />
      <div className="relative mt-0.5 h-3 font-mono text-2xs text-subtle-foreground" aria-hidden>
        {SPECTRUM_LINES.map((hz) => (
          <span
            key={hz}
            className="absolute -translate-x-1/2"
            style={{ left: `${frequencyX(hz) * 100}%` }}
          >
            {label(hz)}
          </span>
        ))}
      </div>
    </PanelCard>
  );
}

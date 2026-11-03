import { cn } from "@/ui";
import { soon } from "../soon";
import { PanelCard } from "../card";

/** Where the grid's lines fall across the box, in % of its width and height. */
const COLUMNS = [20, 40, 60, 80];
const ROWS = [25, 50, 75];

/**
 * "Frequency spectrum": the graph's box with its grid and no curve, since nothing measures the
 * spectrum yet (`loudness.spectrum`, stage 5). The box is the placeholder: its tooltip says what's
 * coming.
 */
export function SpectrumCard() {
  const props = soon("loudness.spectrum");
  return (
    <PanelCard title="Frequency spectrum">
      <button
        type="button"
        aria-label="Frequency spectrum"
        {...props}
        className={cn("block h-[84px] w-full bg-surface-sunken", props.className)}
      >
        <svg className="block size-full" aria-hidden="true">
          {COLUMNS.map((x) => (
            <line key={`x${x}`} x1={`${x}%`} x2={`${x}%`} y1="0" y2="100%" stroke="var(--border)" />
          ))}
          {ROWS.map((y) => (
            <line key={`y${y}`} x1="0" x2="100%" y1={`${y}%`} y2={`${y}%`} stroke="var(--border)" />
          ))}
        </svg>
      </button>
    </PanelCard>
  );
}

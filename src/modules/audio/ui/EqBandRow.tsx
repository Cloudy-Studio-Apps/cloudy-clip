import type { EqBand } from "@/modules/project";
import { NumberField, Switch } from "@/ui";

const SHAPES: readonly EqBand["shape"][] = ["lowCut", "lowShelf", "bell", "highShelf", "highCut"];
const SHAPE_NAME: Record<EqBand["shape"], string> = {
  lowCut: "Low cut",
  lowShelf: "Low shelf",
  bell: "Bell",
  highShelf: "High shelf",
  highCut: "High cut",
};

interface EqBandRowProps {
  index: number;
  band: EqBand;
  disabled: boolean;
  onChange(band: EqBand): void;
}

/** One band: on or off, its shape (a click moves to the next), its frequency and gain. */
export function EqBandRow({ index, band, disabled, onChange }: EqBandRowProps) {
  const next = SHAPES[(SHAPES.indexOf(band.shape) + 1) % SHAPES.length]!;
  const cut = band.shape === "lowCut" || band.shape === "highCut";
  return (
    <div className="grid grid-cols-[30px_16px_minmax(0,1fr)_56px_56px] items-center gap-1.5">
      <Switch
        label={`Band ${index + 1}`}
        checked={band.on}
        disabled={disabled}
        onChange={(on) => onChange({ ...band, on })}
      />
      <b className="font-mono text-xs">{index + 1}</b>
      <button
        type="button"
        title={`Change to ${SHAPE_NAME[next]}`}
        disabled={disabled}
        className="cursor-pointer truncate text-left text-sm text-muted-foreground hover:text-foreground disabled:cursor-default"
        onClick={() => onChange({ ...band, shape: next })}
      >
        {SHAPE_NAME[band.shape]}
      </button>
      <NumberField
        label={`Band ${index + 1} frequency`}
        value={band.hz}
        min={20}
        max={20000}
        unit="Hz"
        disabled={disabled}
        onChange={(hz) => onChange({ ...band, hz })}
      />
      <NumberField
        label={`Band ${index + 1} gain`}
        value={band.db}
        min={-24}
        max={24}
        step={0.5}
        unit="dB"
        disabled={disabled || cut}
        onChange={(db) => onChange({ ...band, db })}
      />
    </div>
  );
}

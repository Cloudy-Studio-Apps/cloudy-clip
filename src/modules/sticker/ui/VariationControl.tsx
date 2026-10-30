import { FieldRow, type FieldControlProps } from "@/modules/inspector";
import { SegmentedControl, cn } from "@/ui";
import type { StickerAxis, StickerVariation } from "../sticker.types";
import { useChoosableAxes } from "./sticker.axes.hook";

interface AxisProps {
  axis: StickerAxis;
  value: string;
  disabled: boolean;
  onChange(option: string): void;
}

/** An axis of colors: a row of swatches. */
function SwatchRow({ axis, value, disabled, onChange }: AxisProps) {
  return (
    <div role="radiogroup" aria-label={axis.label} className="flex gap-1">
      {axis.options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={option.id === value}
          aria-label={option.label}
          title={option.label}
          disabled={disabled}
          className={cn(
            "size-5 cursor-pointer rounded-xs border border-border-strong disabled:cursor-default",
            option.id === value && "ring-2 ring-ring",
          )}
          style={{ backgroundColor: option.swatch }}
          onClick={() => onChange(option.id)}
        />
      ))}
    </div>
  );
}

/**
 * The `sticker-variation` control: one row per axis worth choosing on. A choice keeps the clip's
 * place and is one undo step.
 */
export function VariationControl({ value, values, disabled, live }: FieldControlProps) {
  const axes = useChoosableAxes(values.pack, values.sticker);
  const stored = (value ?? {}) as StickerVariation;
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      {axes.map((axis) => {
        const current = stored[axis.id] ?? axis.default;
        const change = (option: string) =>
          live.commit({ variation: { ...stored, [axis.id]: option } });
        const swatches = axis.options.every((option) => option.swatch);
        return (
          <FieldRow key={axis.id} label={axis.label}>
            {swatches ? (
              <SwatchRow axis={axis} value={current} disabled={disabled} onChange={change} />
            ) : (
              <SegmentedControl
                label={axis.label}
                options={axis.options.map((o) => ({ value: o.id, label: o.label }))}
                value={current}
                disabled={disabled}
                onChange={change}
              />
            )}
          </FieldRow>
        );
      })}
    </div>
  );
}

import { CHECKERBOARD } from "./kit.color";
import { ColorPicker } from "./ColorPicker";
import { Popover } from "./Popover";
import { NumberField } from "./NumberField";
import { HexInput } from "./HexInput";
import type { ColorChangeInfo } from "./kit.types";

interface ColorFieldProps {
  label: string;
  /** `#rrggbb`. */
  color: string;
  /** 0–1; shows the opacity % box and slider when given. */
  opacity?: number;
  onChange(color: string, opacity: number, info: ColorChangeInfo): void;
  recents?: readonly string[];
  swatches?: readonly string[];
}

/** A labelled row: a swatch that opens the picker, the hex text and the opacity %. */
export function ColorField({
  label,
  color,
  opacity,
  onChange,
  recents,
  swatches,
}: ColorFieldProps) {
  const alpha = opacity ?? 1;
  const shown = `${color}${Math.round(alpha * 255)
    .toString(16)
    .padStart(2, "0")}`;
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-xs text-muted-foreground">{label}</span>
      <Popover
        side="left"
        trigger={
          <button
            type="button"
            aria-label={`${label} color`}
            className="size-7 shrink-0 cursor-pointer rounded-sm border border-border"
            style={{
              background: `linear-gradient(${shown}, ${shown}), ${CHECKERBOARD}`,
            }}
          />
        }
      >
        <ColorPicker
          color={color}
          opacity={opacity}
          onChange={onChange}
          recents={recents}
          swatches={swatches}
        />
      </Popover>
      <HexInput
        value={color}
        onChange={(hex) => onChange(hex, alpha, { done: true })}
        className="w-20"
      />
      {opacity !== undefined && (
        <NumberField
          label={`${label} opacity`}
          value={Math.round(opacity * 100)}
          min={0}
          max={100}
          unit="%"
          onChange={(percent) => onChange(color, percent / 100, { done: true })}
          className="w-14"
        />
      )}
    </div>
  );
}

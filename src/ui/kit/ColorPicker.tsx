import { Pipette } from "lucide-react";
import { useState } from "react";
import { ColorArea } from "./ColorArea";
import { ColorSlider } from "./ColorSlider";
import { ColorSwatches } from "./ColorSwatches";
import { HexInput } from "./HexInput";
import { DEFAULT_SWATCHES } from "./kit.color";
import { IconButton } from "./IconButton";
import { hexToHsv, hsvToHex, normalizeHex } from "../lib/color";
import type { ColorChangeInfo, Hsv } from "./kit.types";

interface EyeDropperLike {
  open(): Promise<{ sRGBHex: string }>;
}

interface ColorPickerProps {
  /** `#rrggbb`. */
  color: string;
  /** 0–1; the opacity slider shows only when given. */
  opacity?: number;
  /** Every drag step reports `done: false`; release, typed hex and swatch picks report `done: true`. */
  onChange(color: string, opacity: number, info: ColorChangeInfo): void;
  recents?: readonly string[];
  swatches?: readonly string[];
}

const HUES = "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)";

/** Color area, hue, optional opacity, hex, eyedropper (where supported), swatches and recents. */
export function ColorPicker({
  color,
  opacity,
  onChange,
  recents = [],
  swatches = DEFAULT_SWATCHES,
}: ColorPickerProps) {
  // Hue and saturation are lost in grays; keep them while the same color is shown.
  const [memo, setMemo] = useState({ hex: color, hsv: hexToHsv(color) });
  let hsv = memo.hsv;
  if (memo.hex !== color) {
    hsv = hexToHsv(color);
    setMemo({ hex: color, hsv });
  }
  const alpha = opacity ?? 1;

  const setHsv = (next: Hsv, info: ColorChangeInfo) => {
    const hex = hsvToHex(next);
    setMemo({ hex, hsv: next });
    onChange(hex, alpha, info);
  };
  const pick = (hex: string) => onChange(hex, alpha, { done: true });
  const dropper = typeof window !== "undefined" && "EyeDropper" in window;

  return (
    <div className="flex w-52 flex-col gap-2">
      <ColorArea hsv={hsv} onChange={setHsv} />
      <ColorSlider
        label="Hue"
        value={hsv.h / 360}
        track={HUES}
        onChange={(value, info) => setHsv({ ...hsv, h: Math.min(359.99, value * 360) }, info)}
      />
      {opacity !== undefined && (
        <ColorSlider
          label="Opacity"
          value={opacity}
          checkered
          track={`linear-gradient(to right, transparent, ${color})`}
          onChange={(value, info) => onChange(color, value, info)}
        />
      )}
      <div className="flex gap-1">
        <HexInput value={color} onChange={pick} className="flex-1" />
        {dropper && (
          <IconButton
            label="Pick from screen"
            onClick={() => {
              const Ctor = (window as unknown as { EyeDropper: new () => EyeDropperLike })
                .EyeDropper;
              void new Ctor()
                .open()
                .then((result) => {
                  const hex = normalizeHex(result.sRGBHex);
                  if (hex) pick(hex);
                })
                .catch(() => undefined); // cancelled
            }}
          >
            <Pipette />
          </IconButton>
        )}
      </div>
      <ColorSwatches label="Swatches" colors={swatches} selected={color} onPick={pick} />
      {recents.length > 0 && (
        <ColorSwatches label="Recent" colors={recents} selected={color} onPick={pick} />
      )}
    </div>
  );
}

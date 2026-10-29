import { Pipette } from "lucide-react";
import { useRef, useState } from "react";
import { ColorArea } from "./ColorArea";
import { ColorSlider } from "./ColorSlider";
import { ColorSwatches } from "./ColorSwatches";
import { HexInput } from "./HexInput";
import { CHECKERBOARD, DEFAULT_SWATCHES } from "./kit.color";
import { IconButton } from "./IconButton";
import { hexToHsv, hsvToHex, normalizeHex } from "../lib/color";
import type { ColorChangeInfo, EyeDropperLike, Hsv } from "./kit.types";

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

const opacityTrack = (hex: string) => `linear-gradient(to right, transparent, ${hex})`;
// A picker graphic, not a theme color: white to the hue, then black from the bottom.
const areaBackground = (hue: number) =>
  `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hsvToHex({ h: hue, s: 1, v: 1 })})`;

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

  const root = useRef<HTMLDivElement>(null);
  const part = (name: string) =>
    root.current?.querySelector<HTMLElement>(`[data-color-part="${name}"]`);

  // Drag steps repaint what depends on the color straight in the DOM (no React state per move);
  // the release syncs the state once.
  const paint = (next: Hsv, hex: string) => {
    const area = part("area");
    if (area) area.style.background = areaBackground(next.h);
    const track = part("Opacity");
    if (track) track.style.background = `${opacityTrack(hex)}, ${CHECKERBOARD}`;
    const input = root.current?.querySelector<HTMLInputElement>('input[aria-label="Hex color"]');
    if (input) input.value = hex;
  };
  const setHsv = (next: Hsv, info: ColorChangeInfo) => {
    const hex = hsvToHex(next);
    if (info.done) setMemo({ hex, hsv: next });
    else paint(next, hex);
    onChange(hex, alpha, info);
  };
  const pick = (hex: string) => onChange(hex, alpha, { done: true });
  const dropper = typeof window !== "undefined" && "EyeDropper" in window;

  return (
    <div ref={root} className="flex w-52 flex-col gap-2">
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
          track={opacityTrack(color)}
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

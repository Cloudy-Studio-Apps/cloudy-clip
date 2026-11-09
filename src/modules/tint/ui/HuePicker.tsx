import { useEffect } from "react";
import { notify, useModule } from "@/core";
import { previewRef } from "@/modules/preview";
import { hueOf } from "../logic/color/curves.apply";
import type { Rgb } from "../tint.types";
import { useTintView } from "./view.hook";
import { useTintSet } from "./view.set.hook";

/** How wide the frame is read for a pick (px). */
const READ_WIDTH = 256;

/** The color around `(x, y)` of a frame read back: the mean of up to 3 × 3 pixels, 0…1. */
function colorAt(frame: ImageData, x: number, y: number): Rgb {
  const sum: Rgb = [0, 0, 0];
  let n = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const px = x + dx;
      const py = y + dy;
      if (px < 0 || py < 0 || px >= frame.width || py >= frame.height) continue;
      const i = (py * frame.width + px) * 4;
      sum[0] += frame.data[i]!;
      sum[1] += frame.data[i + 1]!;
      sum[2] += frame.data[i + 2]!;
      n++;
    }
  }
  return [sum[0] / n / 255, sum[1] / n / 255, sum[2] / n / 255];
}

/**
 * Over the viewer while the Curves tool picks a hue (`view.picking`): one click on the picture reads
 * the frame as shown (`picture.readFrame`) there and hands its hue to the tool (`view.picked`), then
 * picking stops. Escape stops it without a pick; a click off the picture does nothing.
 */
export function HuePicker({ stage }: { stage: React.RefObject<HTMLElement | null> }) {
  const { picture } = useModule(previewRef);
  const picking = useTintView((v) => v.picking);
  const set = useTintSet();
  useEffect(() => {
    if (!picking) return;
    const stop = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopImmediatePropagation();
      set({ picking: false });
    };
    window.addEventListener("keydown", stop, true);
    return () => window.removeEventListener("keydown", stop, true);
  }, [picking, set]);
  if (!picking) return null;

  const pick = (event: React.PointerEvent) => {
    const canvas = stage.current?.querySelector("canvas");
    if (!canvas || event.button !== 0) return;
    const rect = canvas.getBoundingClientRect();
    const u = (event.clientX - rect.left) / rect.width;
    const v = (event.clientY - rect.top) / rect.height;
    if (u < 0 || u > 1 || v < 0 || v > 1) return;
    const frame = picture.readFrame(READ_WIDTH);
    if (!frame) return;
    const x = Math.min(frame.width - 1, Math.floor(u * frame.width));
    const y = Math.min(frame.height - 1, Math.floor(v * frame.height));
    const hue = hueOf(colorAt(frame, x, y));
    if (hue === null) notify("info", "That color is a gray: it has no hue to pick.");
    set({ picking: false, picked: hue });
  };
  return (
    <div
      onPointerDown={pick}
      className="absolute inset-0 z-10 cursor-crosshair"
      title="Click a color to pick its hue (Escape stops)"
    />
  );
}

import { useEffect, type RefObject } from "react";
import { useModule } from "@/core";
import { previewRef } from "@/modules/preview";
import { sampleText } from "../logic/sample";
import type { FramePoint } from "../tint.types";

const READ_WIDTH = 512;
const EVERY = 100;

/**
 * Writes what each pinned point reads into its row (`textContent`, no React state) once now and
 * after the frames the preview draws, at most every 100 ms: the last frame of a burst is always
 * read, so a paused picture is never stale.
 * With a `note` (a viewer pass is painting the canvas, so its pixels aren't the picture's) the
 * rows say that instead of reading.
 */
export function useSampleReadouts(
  pins: readonly FramePoint[],
  rows: RefObject<(HTMLElement | null)[]>,
  note: string | null,
): void {
  const { picture } = useModule(previewRef);
  useEffect(() => {
    let timer = 0;
    let last = 0;
    const refresh = () => {
      const frame = note ? null : picture.readFrame(READ_WIDTH);
      pins.forEach((pin, i) => {
        const row = rows.current[i];
        if (row) row.textContent = frame ? sampleText(frame, pin) : (note ?? "");
      });
    };
    refresh();
    const off = picture.onFrame(() => {
      if (timer) return;
      timer = window.setTimeout(
        () => {
          timer = 0;
          last = performance.now();
          refresh();
        },
        Math.max(0, EVERY - (performance.now() - last)),
      );
    });
    return () => {
      off();
      window.clearTimeout(timer);
    };
  }, [picture, pins, rows, note]);
}

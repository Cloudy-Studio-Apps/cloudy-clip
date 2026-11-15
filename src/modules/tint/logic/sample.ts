import type { FramePoint } from "../tint.types";
import { luma } from "./scopes";

/** "R 214 G 196 B 178 · 78%": the pixel of an 8-bit frame at a point, and its luma. */
export function sampleText(
  frame: { data: Uint8ClampedArray; width: number; height: number },
  at: FramePoint,
): string {
  const x = Math.min(frame.width - 1, Math.max(0, Math.floor(at.u * frame.width)));
  const y = Math.min(frame.height - 1, Math.max(0, Math.floor(at.v * frame.height)));
  const i = (y * frame.width + x) * 4;
  const [r, g, b] = [frame.data[i] ?? 0, frame.data[i + 1] ?? 0, frame.data[i + 2] ?? 0];
  return `R ${r} G ${g} B ${b} · ${Math.round((luma(r, g, b) / 255) * 100)}%`;
}

import type { Micros } from "@/core";

const MICROS = 1_000_000;

/** A length as `mm:ss:ff`, in frames of `fps`. */
export function formatLength(time: Micros, fps: number): string {
  const whole = Math.floor(time / MICROS);
  const frames = Math.round(((time % MICROS) / MICROS) * fps);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(whole / 60))}:${pad(whole % 60)}:${pad(frames)}`;
}

/** Reads `mm:ss:ff`, `mm:ss` or seconds. Null when it isn't a length above zero. */
export function parseLength(text: string, fps: number): Micros | null {
  const parts = text.trim().split(":").map(Number);
  if (parts.length > 3 || parts.some((part) => !Number.isFinite(part) || part < 0)) return null;
  const [minutes, seconds, frames] =
    parts.length === 1 ? [0, parts[0]!, 0] : [parts[0]!, parts[1]!, parts[2] ?? 0];
  const time = Math.round((minutes * 60 + seconds + frames / fps) * MICROS);
  return time > 0 ? time : null;
}

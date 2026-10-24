import type { Micros } from "./time.types";

/** Microseconds per second. */
export const MICROS_PER_SECOND = 1_000_000;

/** Converts seconds (e.g. `HTMLMediaElement.currentTime`) to {@link Micros}, rounded. */
export function secondsToMicros(seconds: number): Micros {
  return Math.round(seconds * MICROS_PER_SECOND);
}

/** Converts {@link Micros} to fractional seconds. */
export function microsToSeconds(micros: Micros): number {
  return micros / MICROS_PER_SECOND;
}

/** Formats a time as `HH:MM:SS.cc` (hours omitted when zero). */
export function formatTimecode(micros: Micros): string {
  const negative = micros < 0;
  const totalCentis = Math.floor(Math.abs(micros) / 10_000);
  const centis = totalCentis % 100;
  const totalSeconds = Math.floor(totalCentis / 100);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);
  const pad = (n: number) => n.toString().padStart(2, "0");
  const body = `${hours > 0 ? `${pad(hours)}:` : ""}${pad(minutes)}:${pad(seconds)}.${pad(centis)}`;
  return negative ? `-${body}` : body;
}

import type { Micros } from "@/core";

/** Reads `ss.cc`, `mm:ss.cc` or `hh:mm:ss.cc` as typed into a duration; null when it isn't one. */
export function parseTimecode(text: string): Micros | null {
  const parts = text.trim().split(":").map(Number);
  if (parts.length > 3 || parts.some((part) => !Number.isFinite(part) || part < 0)) return null;
  const seconds = parts.reduce((total, part) => total * 60 + part, 0);
  return seconds > 0 ? Math.round(seconds * 1_000_000) : null;
}

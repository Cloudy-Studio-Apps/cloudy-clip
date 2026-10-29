import type { Clip, SharedGroupValues } from "@/modules/project";

/** The stored values of a shared group on a clip, as a plain record (empty when unset). */
export function groupValue(clip: Clip, key: keyof SharedGroupValues): Record<string, unknown> {
  return { ...(clip[key] ?? {}) };
}

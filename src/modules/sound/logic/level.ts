import { VOLUME_DB_MAX, VOLUME_DB_MIN, type ProjectState } from "@/modules/project";
import type { ClipLoudness, LevelPlan } from "../sound.types";

/** The path of a clip's volume keys. */
export const VOLUME_KEYS = "sound.volumeDb";

/**
 * What Match level does to measured clips. The loudness is of the clip's file as it plays, before
 * its own volume, so a clip without keys gets the volume `target - loudness`, whatever its volume
 * was, and its sound lands on the target. A clip whose volume has keys keeps the curve: every key
 * moves by that same many dB (the curve is written around the file's own level). Without a
 * `target` it is the loudest clip's loudness, which turns nothing up past it. Clips with no sound
 * or silent are skipped. `clamped` is set when a value would pass the volume range.
 */
export function levelPlan(
  state: ProjectState,
  measured: readonly ClipLoudness[],
  targetLufs?: number,
): LevelPlan {
  const skipped: LevelPlan["skipped"] = [];
  const loud: { clipId: string; lufs: number }[] = [];
  for (const { clipId, lufs, noSound } of measured) {
    if (noSound) skipped.push({ clipId, reason: "It has no sound of its own to measure." });
    else if (lufs === null) skipped.push({ clipId, reason: "It is silent." });
    else loud.push({ clipId, lufs });
  }
  const target = targetLufs ?? (loud.length > 0 ? Math.max(...loud.map((c) => c.lufs)) : null);
  const changes = loud.map(({ clipId, lufs }) => {
    const deltaDb = target! - lufs;
    const keys = state.clips[clipId]?.animation?.[VOLUME_KEYS];
    if (keys) {
      const min = keys.min ?? VOLUME_DB_MIN;
      const max = keys.max ?? VOLUME_DB_MAX;
      const clamped = keys.keys.some(
        (key) =>
          typeof key.value === "number" && (key.value + deltaDb > max || key.value + deltaDb < min),
      );
      return { clipId, lufs, deltaDb, volumeDb: null, clamped };
    }
    const wanted = deltaDb;
    const volumeDb = Math.min(VOLUME_DB_MAX, Math.max(VOLUME_DB_MIN, wanted));
    return { clipId, lufs, deltaDb, volumeDb, clamped: volumeDb !== wanted };
  });
  return { target, changes, skipped };
}

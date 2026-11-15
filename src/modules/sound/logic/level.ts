import { VOLUME_DB_MAX, VOLUME_DB_MIN, soundOf, type ProjectState } from "@/modules/project";
import type { ClipLoudness, LevelPlan } from "../sound.tools.types";

/** The path of a clip's volume keys. */
export const VOLUME_KEYS = "sound.volumeDb";

/**
 * What Match level does to measured clips. The loudness is as heard through the clip's own volume,
 * so the change is relative: `target - loudness` is added to its static volume (kept in -60..12,
 * `clamped` otherwise) or, when its volume has keys, to every key alike, so the curve keeps its
 * shape (a key at the range's edge stops there and is `clamped`). Without a `target` it is the
 * loudest clip's, which turns nothing up past it. Clips with no sound or silent are skipped.
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
  const exact = targetLufs ?? (loud.length > 0 ? Math.max(...loud.map((c) => c.lufs)) : null);
  const target = exact === null ? null : round(exact);
  const changes = loud.map(({ clipId, lufs: measuredLufs }) => {
    const lufs = round(measuredLufs);
    const deltaDb = round(exact! - measuredLufs);
    const keys = state.clips[clipId]?.animation?.[VOLUME_KEYS];
    if (keys?.keys.length) {
      const min = keys.min ?? VOLUME_DB_MIN;
      const max = keys.max ?? VOLUME_DB_MAX;
      const clamped = keys.keys.some(
        (key) =>
          typeof key.value === "number" && (key.value + deltaDb > max || key.value + deltaDb < min),
      );
      return { clipId, lufs, deltaDb, volumeDb: null, clamped };
    }
    const wanted = round(soundOf(state.clips[clipId]!).volumeDb + deltaDb);
    const volumeDb = Math.min(VOLUME_DB_MAX, Math.max(VOLUME_DB_MIN, wanted));
    return { clipId, lufs, deltaDb, volumeDb, clamped: volumeDb !== wanted };
  });
  return { target, changes, skipped };
}

/** To 0.01 dB, so what is reported is what is applied, free of float noise. */
function round(db: number): number {
  return Math.round(db * 100) / 100;
}

import type { Micros } from "@/core";
import { envelope } from "@/modules/export";
import { mediaHasAudio, type MediaApi } from "@/modules/media";
import {
  dbToLinear,
  keyMoments,
  soundOf,
  trackValue,
  followsFileTime,
  partnersOf,
  sourceSpan,
  speedOf,
  type Clip,
  type ClipId,
  type ProjectState,
} from "@/modules/project";
import { createScanner } from "./sound.scan";
import { beginLoudness, cancelLoudness, finishLoudness } from "./sound.service";
import type { ClipLoudness, LoudPart, LoudnessMeter } from "./sound.tools.types";

/** The clip that carries the sound of `clip`: itself on an audio track, or its linked sound clip. */
export function soundCarrier(state: ProjectState, clip: Clip): Clip | undefined {
  return [clip, ...partnersOf(state, clip.id)].find(
    (one) => state.tracks[one.trackId]?.kind === "audio",
  );
}

/**
 * Creates the loudness meter of a kernel. It measures the part of the file a clip plays (its
 * trims and speed, through `sourceSpan`) as it is heard through the clip's own volume (its static
 * volume, or its volume keys sampled by the export's `envelope` over the file's time, mirrored on a
 * reversed clip), before its fades, EQ, track, group and master. A volume change makes the
 * measurement stale (it is in the key). A clip with no file of its own
 * (text, a held frame, a nested composition) or whose file has no sound is marked `noSound`; a
 * picture clip is measured through its linked sound, and each sound clip once.
 */
export function createLoudnessMeter(project: () => ProjectState, media: MediaApi): LoudnessMeter {
  const scanner = createScanner<LoudPart, number | null>({
    begin: ({ path, from, to, gain, gainEnvelope }, onDone) =>
      beginLoudness(path, from, to, gain, gainEnvelope, onDone),
    finish: finishLoudness,
    cancel: cancelLoudness,
    empty: null,
  });

  const partsOf = (clipIds: readonly ClipId[]) => {
    const state = project();
    const seen = new Set<ClipId>();
    const parts: ({ clipId: ClipId } & (LoudPart | { noSound: true }))[] = [];
    for (const id of clipIds) {
      const named = state.clips[id];
      if (!named) continue;
      const clip = soundCarrier(state, named) ?? named;
      if (seen.has(clip.id)) continue;
      seen.add(clip.id);
      const file = clip.mediaId === undefined ? undefined : state.media[clip.mediaId];
      if (
        !file ||
        state.tracks[clip.trackId]?.kind !== "audio" ||
        !followsFileTime(state, clip) ||
        !mediaHasAudio(media.getProbe(file.id))
      ) {
        parts.push({ clipId: clip.id, noSound: true });
        continue;
      }
      const from = clip.sourceIn;
      const to = from + sourceSpan(clip);
      const keys = clip.animation?.["sound.volumeDb"];
      const volume = keys?.keys.length ? keys : undefined;
      const origin = clip.animationOrigin ?? 0;
      const span = to - from;
      const gain = dbToLinear(soundOf(clip).volumeDb);
      // Keys sit in content time, which counts the file played (`contentTime`), so `x` into the
      // part is `origin + x`, or `origin + span - x` on a reversed clip, which plays it backwards.
      // A ramp's keys land where they should; its stretch of the sound itself isn't measured.
      const reversed = speedOf(clip).reversed;
      const fileAt = (c: Micros) => (reversed ? origin + span - c : c - origin);
      const gainEnvelope = volume
        ? envelope(
            (x) => dbToLinear(Number(trackValue(volume, origin + (reversed ? span - x : x)))),
            0,
            span,
            keyMoments(volume, origin, origin + span).map(fileAt),
          )
        : [];
      const key = [file.path, from, to, gain, JSON.stringify(gainEnvelope)].join("|");
      parts.push({ clipId: clip.id, path: file.path, from, to, key, gain, gainEnvelope });
    }
    return parts;
  };
  const loudnessOf = (part: ReturnType<typeof partsOf>[number]): ClipLoudness =>
    "noSound" in part
      ? { clipId: part.clipId, lufs: null, noSound: true }
      : { clipId: part.clipId, lufs: scanner.get(part.key) ?? null };

  return {
    async measure(clipIds, onProgress, signal) {
      const parts = partsOf(clipIds);
      await scanner.run(
        parts.filter((p): p is { clipId: ClipId } & LoudPart => "key" in p),
        onProgress,
        signal,
      );
      return parts.map(loudnessOf);
    },
    kept(clipIds) {
      const parts = partsOf(clipIds);
      if (parts.some((p) => "key" in p && !scanner.has(p.key))) return null;
      return parts.map(loudnessOf);
    },
    cancelAll: scanner.cancelAll,
    forget: scanner.forget,
  };
}

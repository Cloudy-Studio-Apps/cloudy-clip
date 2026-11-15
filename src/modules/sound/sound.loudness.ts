import { mediaHasAudio, type MediaApi } from "@/modules/media";
import {
  followsFileTime,
  partnersOf,
  sourceSpan,
  type Clip,
  type ClipId,
  type ProjectState,
} from "@/modules/project";
import { createScanner, type ScanPart } from "./sound.scan";
import { beginLoudness, cancelLoudness, finishLoudness } from "./sound.service";
import type { ClipLoudness, LoudnessMeter } from "./sound.types";

/** The clip that carries the sound of `clip`: itself on an audio track, or its linked sound clip. */
export function soundCarrier(state: ProjectState, clip: Clip): Clip | undefined {
  return [clip, ...partnersOf(state, clip.id)].find(
    (one) => state.tracks[one.trackId]?.kind === "audio",
  );
}

/**
 * Creates the loudness meter of a kernel. It measures the part of the file a clip plays (its
 * trims and speed, through `sourceSpan`), as the file is, before the clip's volume, fades, EQ or
 * track: the same figure however the clip is turned up or down. A clip with no file of its own
 * (text, a held frame, a nested composition) or whose file has no sound is marked `noSound`; a
 * picture clip is measured through its linked sound, and each sound clip once.
 */
export function createLoudnessMeter(project: () => ProjectState, media: MediaApi): LoudnessMeter {
  const scanner = createScanner<ScanPart, number | null>({
    begin: ({ path, from, to }, onDone) => beginLoudness(path, from, to, onDone),
    finish: finishLoudness,
    cancel: cancelLoudness,
    empty: null,
  });

  const partsOf = (clipIds: readonly ClipId[]) => {
    const state = project();
    const seen = new Set<ClipId>();
    const parts: ({ clipId: ClipId } & (ScanPart | { noSound: true }))[] = [];
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
      parts.push({
        clipId: clip.id,
        path: file.path,
        from,
        to,
        key: [file.path, from, to].join("|"),
      });
    }
    return parts;
  };
  const loudnessOf = (part: ReturnType<typeof partsOf>[number]): ClipLoudness =>
    "noSound" in part
      ? { clipId: part.clipId, lufs: null, noSound: true }
      : { clipId: part.clipId, lufs: scanner.get(part.key) ?? null };

  return {
    async measure(clipIds, onProgress) {
      const parts = partsOf(clipIds);
      await scanner.run(
        parts.filter((p): p is { clipId: ClipId } & ScanPart => "key" in p),
        onProgress,
      );
      return parts.map(loudnessOf);
    },
    kept(clipIds) {
      const parts = partsOf(clipIds);
      if (parts.some((p) => "key" in p && !scanner.has(p.key))) return null;
      return parts.map(loudnessOf);
    },
    cancel: scanner.cancel,
    forget: scanner.forget,
  };
}

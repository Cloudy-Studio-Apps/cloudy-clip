import type { Micros } from "@/core";
import { mediaHasAudio, type MediaApi } from "@/modules/media";
import {
  followsFileTime,
  partnersOf,
  sourceSpan,
  type Clip,
  type ClipId,
  type ProjectState,
} from "@/modules/project";
import { cutsFor } from "./logic/silence";
import { createScanner } from "./sound.scan";
import { beginSilences, cancelSilences, finishSilences } from "./sound.service";
import type { ClipCuts, SilenceFinder, SilenceParams, SilencePart } from "./sound.tools.types";

/**
 * Creates the silence finder of a kernel. The native side scans the part of the file a clip plays
 * (progress, cancel); what it found is kept per kernel (never in the project) until `forget`.
 * Clips with no file of their own (text, a held frame, a nested composition) have no cuts, a clip
 * whose file has no sound is marked `noSound`, and a linked pair is cut once, from the first one named.
 */
export function createSilenceFinder(project: () => ProjectState, media: MediaApi): SilenceFinder {
  const scanner = createScanner<SilencePart, [Micros, Micros][]>({
    begin: ({ path, from, to, params }, onDone) =>
      beginSilences(path, from, to, params.thresholdDb, params.minMs, onDone),
    finish: finishSilences,
    cancel: cancelSilences,
    empty: [],
  });

  const partsOf = (clipIds: readonly ClipId[], params: SilenceParams) => {
    const state = project();
    const seen = new Set<ClipId>();
    const parts: (SilencePart | { clip: Clip; noSound: true })[] = [];
    for (const id of clipIds) {
      const clip = state.clips[id];
      const file = clip?.mediaId === undefined ? undefined : state.media[clip.mediaId];
      if (!clip || !file || seen.has(id) || !followsFileTime(state, clip)) continue;
      for (const linked of [clip, ...partnersOf(state, id)]) seen.add(linked.id);
      if (!mediaHasAudio(media.getProbe(file.id))) {
        parts.push({ clip, noSound: true });
        continue;
      }
      const from = clip.sourceIn;
      const to = from + sourceSpan(clip);
      const key = [file.path, from, to, params.thresholdDb, params.minMs].join("|");
      parts.push({ clip, path: file.path, from, to, key, params });
    }
    return parts;
  };
  const cutsOf = (
    part: SilencePart | { clip: Clip; noSound: true },
    params: SilenceParams,
  ): ClipCuts =>
    "noSound" in part
      ? { clipId: part.clip.id, cuts: [], noSound: true }
      : {
          clipId: part.clip.id,
          cuts: cutsFor(part.clip, scanner.get(part.key)!, params.padMs, params.minMs),
        };

  return {
    async scan(clipIds, params, onProgress, signal) {
      const parts = partsOf(clipIds, params);
      await scanner.run(
        parts.filter((p): p is SilencePart => "key" in p),
        onProgress,
        signal,
      );
      return parts.map((part) => cutsOf(part, params));
    },
    kept(clipIds, params) {
      const parts = partsOf(clipIds, params);
      if (parts.some((p) => "key" in p && !scanner.has(p.key))) return null;
      return parts.map((part) => cutsOf(part, params));
    },
    cancelAll: scanner.cancelAll,
    forget: scanner.forget,
  };
}

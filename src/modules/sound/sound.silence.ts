import type { Micros } from "@/core";
import {
  followsFileTime,
  partnersOf,
  sourceSpan,
  type ClipId,
  type ProjectState,
} from "@/modules/project";
import { cutsFor } from "./logic/silence";
import { findFileSilences } from "./sound.service";
import type { ClipCuts, SilenceFinder } from "./sound.types";

/** The most stretches kept: a dialog's previews are few, and a file may change under them. */
const KEPT = 50;

/**
 * Creates the silence finder of a kernel. The native side detects over the part of the file a clip
 * plays; what it found is kept until `forget` (a preview, then the command that uses it, ask once).
 * Clips with no file of their own (text, a held frame, a nested composition) have no cuts, and a
 * linked pair is cut once, from the first one named.
 */
export function createSilenceFinder(project: () => ProjectState): SilenceFinder {
  const found = new Map<string, Promise<[Micros, Micros][]>>();
  return {
    async cutsOf(clipIds: readonly ClipId[], params) {
      const state = project();
      const seen = new Set<ClipId>();
      const jobs: Promise<ClipCuts>[] = [];
      for (const id of clipIds) {
        const clip = state.clips[id];
        const media = clip?.mediaId === undefined ? undefined : state.media[clip.mediaId];
        if (!clip || !media || seen.has(id) || !followsFileTime(state, clip)) continue;
        for (const linked of [clip, ...partnersOf(state, id)]) seen.add(linked.id);
        const from = clip.sourceIn;
        const to = from + sourceSpan(clip);
        const key = [media.path, from, to, params.thresholdDb, params.minMs].join("|");
        let stretches = found.get(key);
        if (!stretches) {
          stretches = findFileSilences(media.path, from, to, params.thresholdDb, params.minMs);
          found.set(key, stretches);
          if (found.size > KEPT) found.delete(found.keys().next().value!);
          stretches.catch(() => found.delete(key));
        }
        jobs.push(
          stretches.then((list) => ({
            clipId: id,
            cuts: cutsFor(clip, list, params.padMs, params.minMs),
          })),
        );
      }
      return Promise.all(jobs);
    },
    forget: () => found.clear(),
  };
}

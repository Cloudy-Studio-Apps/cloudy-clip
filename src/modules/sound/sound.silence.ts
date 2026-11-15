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
import { beginSilences, cancelSilences, finishSilences } from "./sound.service";
import type { ClipCuts, SilenceFinder, SilenceParams } from "./sound.types";

/** The most stretches kept: a dialog's looks are few, and a file may change under them. */
const KEPT = 50;
/** Files scanned at once: each is an FFmpeg decoding. */
const AT_ONCE = 2;

/** What one clip is scanned for: its file and the part of it the clip plays. */
interface Part {
  clip: Clip;
  path: string;
  from: Micros;
  to: Micros;
  key: string;
}

/**
 * Creates the silence finder of a kernel. The native side scans the part of the file a clip plays
 * (progress, cancel); what it found is kept per kernel (never in the project) until `forget`.
 * Clips with no file of their own (text, a held frame, a nested composition) have no cuts, a clip
 * whose file has no sound is marked `noSound`, and a linked pair is cut once, from the first one named.
 */
export function createSilenceFinder(project: () => ProjectState, media: MediaApi): SilenceFinder {
  const found = new Map<string, [Micros, Micros][]>();
  const running = new Set<string>();
  let epoch = 0;

  const partsOf = (clipIds: readonly ClipId[], params: SilenceParams) => {
    const state = project();
    const seen = new Set<ClipId>();
    const parts: (Part | { clip: Clip; noSound: true })[] = [];
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
      parts.push({ clip, path: file.path, from, to, key });
    }
    return parts;
  };
  const cutsOf = (part: Part | { clip: Clip; noSound: true }, params: SilenceParams): ClipCuts =>
    "noSound" in part
      ? { clipId: part.clip.id, cuts: [], noSound: true }
      : {
          clipId: part.clip.id,
          cuts: cutsFor(part.clip, found.get(part.key)!, params.padMs, params.minMs),
        };

  async function one(part: Part, params: SilenceParams, mine: number, onDone: (p: number) => void) {
    if (mine !== epoch) throw new Error("Cancelled");
    const id = await beginSilences(
      part.path,
      part.from,
      part.to,
      params.thresholdDb,
      params.minMs,
      onDone,
    );
    if (id === null) {
      found.set(part.key, []);
      return;
    }
    running.add(id);
    if (mine !== epoch) void cancelSilences(id).catch(() => undefined);
    try {
      found.set(part.key, await finishSilences(id));
      if (found.size > KEPT) found.delete(found.keys().next().value!);
    } finally {
      running.delete(id);
    }
  }

  return {
    async scan(clipIds, params, onProgress) {
      const mine = epoch;
      const parts = partsOf(clipIds, params);
      const todo = parts.filter((p): p is Part => "key" in p && !found.has(p.key));
      const unique = [...new Map(todo.map((p) => [p.key, p])).values()];
      const shares = new Map<string, number>();
      const report = (key: string) => (p: number) => {
        shares.set(key, p);
        const sum = [...shares.values()].reduce((a, b) => a + b, 0);
        onProgress?.(sum / unique.length);
      };
      const queue = [...unique];
      const worker = async () => {
        for (let part = queue.shift(); part; part = queue.shift()) {
          await one(part, params, mine, report(part.key));
          report(part.key)(1);
        }
      };
      try {
        await Promise.all(Array.from({ length: Math.min(AT_ONCE, queue.length) }, worker));
      } catch (error) {
        // One failing stops the others still waiting.
        queue.length = 0;
        throw error;
      }
      return parts.map((part) => cutsOf(part, params));
    },
    kept(clipIds, params) {
      const parts = partsOf(clipIds, params);
      if (parts.some((p) => "key" in p && !found.has(p.key))) return null;
      return parts.map((part) => cutsOf(part, params));
    },
    cancel() {
      epoch += 1;
      for (const id of running) void cancelSilences(id).catch(() => undefined);
    },
    forget: () => found.clear(),
  };
}

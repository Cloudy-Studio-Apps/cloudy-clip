import { createId, type Micros } from "@/core";
import type { Clip, ClipId, Composition, ProjectState, TrackId } from "@/modules/project";
import { withPartners } from "@/modules/project";
import type { ClipboardEntry, PastePlacement } from "../timeline.types";
import { findOverlap } from "./placement";

/** The clips and their partners as something to paste. */
export function clipboardEntry(state: ProjectState, clipIds: readonly ClipId[]): ClipboardEntry {
  const clips = withPartners(state, clipIds).flatMap((id) => state.clips[id] ?? []);
  const trackKinds = Object.fromEntries(
    clips.map(({ trackId }) => [trackId, state.tracks[trackId]!.kind]),
  );
  return {
    clips: structuredClone(clips),
    origin: Math.min(...clips.map((clip) => clip.start)),
    trackKinds,
  };
}

/** A track's copied clips at their new times. Clips joined by a junction lose their overlap. */
function lay(clips: readonly Clip[], offset: Micros): Clip[] {
  let free = 0;
  return [...clips]
    .sort((a, b) => a.start - b.start)
    .map((clip) => {
      const start = Math.max(clip.start + offset, free);
      free = start + clip.duration;
      return { ...structuredClone(clip), id: createId("clip"), start };
    });
}

/** The copied tracks in their display order; ones that are gone come last. */
function copiedTracks(state: ProjectState, entry: ClipboardEntry): TrackId[] {
  const rank = (id: TrackId) => {
    const home = state.tracks[id]?.compositionId;
    const order = home === undefined ? undefined : state.compositions[home]?.trackOrder;
    return order?.indexOf(id) ?? Number.POSITIVE_INFINITY;
  };
  const ids = [...new Set(entry.clips.map((clip) => clip.trackId))];
  return ids.sort((a, b) => rank(a) - rank(b));
}

/**
 * Where a paste lands: everything from one track stays together, on the track it came from when
 * that is in `composition` and free, else on the first free one of its kind, else on a new one.
 * With `trackId`, the first copied track of that kind goes there and the others keep their
 * distance in tracks from it.
 */
export function pastePlan(
  state: ProjectState,
  composition: Composition,
  entry: ClipboardEntry,
  { time, trackId }: { time: Micros; trackId?: TrackId },
): PastePlacement[] {
  const links = new Map<string, string>();
  const relink = (linkId: string) => {
    const next = links.get(linkId) ?? createId("link");
    links.set(linkId, next);
    return next;
  };
  const used = new Set<TrackId>();
  const seen = new Map<string, number>();
  const anchor = trackId === undefined ? undefined : state.tracks[trackId];
  return copiedTracks(state, entry).map((source) => {
    const kind = entry.trackKinds[source]!;
    const nth = seen.get(kind) ?? 0;
    seen.set(kind, nth + 1);
    const ofKind = composition.trackOrder.filter((id) => state.tracks[id]?.kind === kind);
    const wanted =
      anchor?.kind === kind && trackId !== undefined
        ? ofKind[ofKind.indexOf(trackId) + nth]
        : source;
    const laid = lay(
      entry.clips.filter((clip) => clip.trackId === source),
      time - entry.origin,
    );
    const free = (id: TrackId) =>
      !used.has(id) && laid.every((c) => !findOverlap(state, id, c.start, c.duration));
    const target = [
      ...(wanted !== undefined && ofKind.includes(wanted) ? [wanted] : []),
      ...ofKind,
    ].find(free);
    if (target !== undefined) used.add(target);
    const clips = laid.map((clip) => ({
      ...clip,
      trackId: target ?? "",
      ...(clip.linkId !== undefined && { linkId: relink(clip.linkId) }),
    }));
    return { kind, trackId: target ?? null, clips };
  });
}

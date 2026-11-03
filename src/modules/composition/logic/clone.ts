import { current, type Draft } from "immer";
import { createId } from "@/core";
import type { ClipId, CompositionId, ProjectState, TrackId } from "@/modules/project";

/**
 * Copies a composition with its tracks, clips, junctions and markers under new ids. Links stay links within
 * the copy; compositions placed in it stay shared.
 */
export function cloneComposition(
  draft: Draft<ProjectState>,
  compositionId: CompositionId,
  name: string,
): CompositionId {
  const state = current(draft);
  const original = state.compositions[compositionId]!;
  const id = createId("composition");
  const tracks = new Map<TrackId, TrackId>();
  const clips = new Map<ClipId, ClipId>();
  const links = new Map<string, string>();
  for (const trackId of original.trackOrder) tracks.set(trackId, createId("track"));
  for (const [trackId, copyId] of tracks) {
    const track = state.tracks[trackId]!;
    for (const clipId of track.clipIds) clips.set(clipId, createId("clip"));
    draft.tracks[copyId] = {
      ...structuredClone(track),
      id: copyId,
      compositionId: id,
      clipIds: track.clipIds.map((clipId) => clips.get(clipId)!),
    };
  }
  for (const [clipId, copyId] of clips) {
    const clip = structuredClone(state.clips[clipId]!);
    if (clip.linkId) {
      if (!links.has(clip.linkId)) links.set(clip.linkId, createId("link"));
      clip.linkId = links.get(clip.linkId)!;
    }
    draft.clips[copyId] = { ...clip, id: copyId, trackId: tracks.get(clip.trackId)! };
  }
  for (const junction of Object.values(state.junctions)) {
    const trackId = tracks.get(junction.trackId);
    if (!trackId) continue;
    const copyId = createId("junction");
    draft.junctions[copyId] = {
      ...structuredClone(junction),
      id: copyId,
      trackId,
      leftClipId: clips.get(junction.leftClipId)!,
      rightClipId: clips.get(junction.rightClipId)!,
    };
  }
  for (const marker of Object.values(state.markers)) {
    if (marker.compositionId !== compositionId) continue;
    const copyId = createId("marker");
    draft.markers[copyId] = { ...marker, id: copyId, compositionId: id };
  }
  draft.compositions[id] = {
    ...structuredClone(original),
    id,
    name,
    trackOrder: original.trackOrder.map((trackId) => tracks.get(trackId)!),
  };
  const other = draft.compositions[id]!.mix?.otherMix;
  if (other) {
    other.tracks = Object.fromEntries(
      Object.entries(other.tracks).flatMap(([trackId, mix]) => {
        const copyId = tracks.get(trackId);
        return copyId ? [[copyId, mix]] : [];
      }),
    );
  }
  draft.compositionOrder.push(id);
  return id;
}

/** The next free "<name> copy" name. */
export function copyName(state: ProjectState, name: string): string {
  const taken = new Set(Object.values(state.compositions).map((c) => c.name));
  const first = `${name} copy`;
  if (!taken.has(first)) return first;
  let n = 2;
  while (taken.has(`${first} ${n}`)) n++;
  return `${first} ${n}`;
}

import { current, type Draft } from "immer";
import { createId } from "@/core";
import type { ClipId, CompositionId, ProjectState, TrackId } from "@/modules/project";

/**
 * Copies a composition with its tracks, clips, junctions, markers, motion paths and subtitle styles
 * under new ids. Links stay links within the copy; compositions placed in it stay shared.
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
    if (clip.matte) clip.matte.trackId = tracks.get(clip.matte.trackId) ?? clip.matte.trackId;
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
  // Every path comes along (unused ones too); the copied clips follow the copies.
  const paths = new Map<string, string>();
  for (const path of Object.values(state.paths ?? {})) {
    if (path.compositionId !== compositionId) continue;
    const copyId = createId("path");
    (draft.paths ??= {})[copyId] = { ...structuredClone(path), id: copyId, compositionId: id };
    paths.set(path.id, copyId);
  }
  for (const copyId of clips.values()) {
    const follow = draft.clips[copyId]!.follow;
    if (follow) follow.pathId = paths.get(follow.pathId) ?? follow.pathId;
  }
  // Every subtitle style comes along (unused ones too) in its order; the copied cues follow.
  const styles = new Map<string, string>();
  for (const style of Object.values(state.subtitleStyles ?? {})) {
    if (style.compositionId !== compositionId) continue;
    const copyId = createId("sub");
    (draft.subtitleStyles ??= {})[copyId] = {
      ...structuredClone(style),
      id: copyId,
      compositionId: id,
    };
    styles.set(style.id, copyId);
  }
  for (const copyId of clips.values()) {
    const subtitle = draft.clips[copyId]!.subtitle;
    if (subtitle) subtitle.styleId = styles.get(subtitle.styleId) ?? subtitle.styleId;
  }
  draft.compositions[id] = {
    ...structuredClone(original),
    id,
    name,
    trackOrder: original.trackOrder.map((trackId) => tracks.get(trackId)!),
    ...(original.subtitleStyleOrder && {
      subtitleStyleOrder: original.subtitleStyleOrder.map((s) => styles.get(s) ?? s),
    }),
  };
  const copy = draft.compositions[id]!;
  const other = copy.mix?.otherMix;
  if (other) {
    other.tracks = Object.fromEntries(
      Object.entries(other.tracks).flatMap(([trackId, mix]) => {
        const copyId = tracks.get(trackId);
        return copyId ? [[copyId, mix]] : [];
      }),
    );
  }
  // Groups get new ids too; what sends to one, or ducks under one, follows its copy.
  const buses = new Map<string, string>();
  for (const bus of [...(copy.mix?.buses ?? []), ...(other?.buses ?? [])]) {
    if (!buses.has(bus.id)) buses.set(bus.id, createId("bus"));
  }
  for (const bus of [...(copy.mix?.buses ?? []), ...(other?.buses ?? [])])
    bus.id = buses.get(bus.id)!;
  // A copied duck listens to the copied tracks and groups, not the original's.
  const remap = (
    mix: { busId?: string; effects?: { kind: string; listensTo?: string[] }[] } | undefined,
  ) => {
    if (mix?.busId !== undefined) {
      const copied = buses.get(mix.busId);
      if (copied) mix.busId = copied;
      else delete mix.busId;
    }
    for (const effect of mix?.effects ?? []) {
      if (effect.kind === "duck" && effect.listensTo) {
        effect.listensTo = effect.listensTo.flatMap((heard) => {
          const copied = tracks.get(heard) ?? buses.get(heard);
          return copied ? [copied] : [];
        });
      }
    }
  };
  for (const copyId of tracks.values()) remap(draft.tracks[copyId]!.mix);
  for (const mix of Object.values(other?.tracks ?? {})) remap(mix);
  for (const bus of [...(copy.mix?.buses ?? []), ...(other?.buses ?? [])]) remap(bus);
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

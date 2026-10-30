import {
  clipEnd,
  compositionOf,
  trackClips,
  withPartners,
  type Clip,
  type ClipId,
  type Junction,
  type ProjectState,
} from "@/modules/project";
import type { GroupPlan } from "../composition.types";

/**
 * What grouping `clipIds` (and their linked clips) means: the span they cover, the top tracks the
 * placement goes on, and the junctions that cross the edge of the selection. `blocked` is the
 * clip in the way of the placement, or a clip of another composition.
 */
export function planGroup(state: ProjectState, clipIds: readonly ClipId[]): GroupPlan {
  const ids = withPartners(state, [...clipIds]);
  const clips = ids.flatMap((id) => (state.clips[id] ? [state.clips[id]] : []));
  const first = clips[0]!;
  const home = compositionOf(state, state.tracks[first.trackId]!);
  const strange = clips.find((clip) => state.tracks[clip.trackId]?.compositionId !== home.id);
  if (strange) return { blocked: strange };

  const selected = new Set(ids);
  const used = new Set(clips.map((clip) => clip.trackId));
  const topOf = (kind: "video" | "audio") =>
    home.trackOrder.find((id) => used.has(id) && state.tracks[id]?.kind === kind) ?? null;
  const videoTrack = topOf("video");
  const audioTrack = topOf("audio");
  const start = Math.min(...clips.map((clip) => clip.start));
  const end = Math.max(...clips.map(clipEnd));

  // A neighbour joined at the edge of the selection overlaps it, and is trimmed to the edge.
  const junctions = Object.values(state.junctions);
  const crossing = junctions.filter(
    (j) => selected.has(j.leftClipId) !== selected.has(j.rightClipId),
  );
  const atEdge = (j: Junction) =>
    selected.has(j.leftClipId)
      ? state.clips[j.leftClipId]!.start + state.clips[j.leftClipId]!.duration === end
      : state.clips[j.rightClipId]!.start === start;
  const neighbours = new Set(
    withPartners(
      state,
      crossing
        .filter(atEdge)
        .map((j) => (selected.has(j.leftClipId) ? j.rightClipId : j.leftClipId)),
    ),
  );
  const inTheWay = (clip: Clip) =>
    !selected.has(clip.id) && !neighbours.has(clip.id) && clip.start < end && clipEnd(clip) > start;
  for (const trackId of [videoTrack, audioTrack]) {
    const track = trackId === null ? undefined : state.tracks[trackId];
    const blocked = track && trackClips(state, track).find(inTheWay);
    if (blocked) return { blocked };
  }
  return {
    homeId: home.id,
    span: { start, end },
    videoTrack,
    audioTrack,
    clips: ids,
    droppedJunctions: crossing.map((j) => j.id),
    neighbours: [...neighbours],
  };
}

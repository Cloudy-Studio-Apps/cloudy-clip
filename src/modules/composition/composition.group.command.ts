import { z } from "zod";
import { CommandFailure, createId, defineCommand } from "@/core";
import { contentTime, projectRef, type Clip, type TrackId } from "@/modules/project";
import { addTrack, sortClipIds } from "@/modules/timeline";
import type { GroupSpan } from "./composition.types";
import { planGroup } from "./logic/group";

/** Cuts a clip left beside the placement to the edge of `span`, on the placement's tracks. */
function trimToSpan(clip: Clip, { start, end }: GroupSpan): void {
  const clipStop = clip.start + clip.duration;
  if (clip.start < start && clipStop > start) clip.duration = start - clip.start;
  else if (clip.start >= start && clip.start < end && clipStop > end) {
    const cut = end - clip.start;
    if (clip.animation) clip.animationOrigin = contentTime(clip, end);
    clip.start = end;
    clip.duration -= cut;
    if (clip.mediaId !== undefined || clip.compositionRef !== undefined) clip.sourceIn += cut;
  }
}

/** Puts clips into a new composition, and a placement of it where they were. */
export const groupClips = defineCommand({
  id: "composition.group",
  label: "Group into composition",
  description:
    "Moves clips and their linked clips into a new composition with the current size and frame rate, times starting at 0, and leaves a placement in their place, spanning from the first to the last of them. A transition between a moved clip and one left behind is removed. Fails with composition.group_blocked, changing nothing, if another clip sits in that span on the placement's tracks, or the clips are in different compositions. Returns { compositionId, clips } (the placement's ids, picture first).",
  undoable: true,
  input: z.object({ clipIds: z.array(z.string()).min(1) }),
  async run(ctx, { clipIds }) {
    const { store } = ctx.require(projectRef);
    for (const id of clipIds) {
      if (!store.getState().clips[id]) {
        throw new CommandFailure("timeline.clip_not_found", `No clip with id "${id}"`);
      }
    }
    const plan = planGroup(store.getState(), clipIds);
    if ("blocked" in plan) {
      throw new CommandFailure(
        "composition.group_blocked",
        `Clip "${plan.blocked.id}" is in the way. Select it too, or move it first.`,
        { clipId: plan.blocked.id },
      );
    }
    const { homeId, span, clips: moved, droppedJunctions, neighbours } = plan;
    const trackFor = async (kind: "video" | "audio", found: TrackId | null): Promise<TrackId> =>
      found ?? (await ctx.execute(addTrack, { kind, compositionId: homeId })).trackId;
    const videoTrack = await trackFor("video", plan.videoTrack);
    const audioTrack = await trackFor("audio", plan.audioTrack);

    const id = createId("composition");
    const linkId = createId("link");
    const placement = [videoTrack, audioTrack].map((trackId): Clip => ({
      id: createId("clip"),
      trackId,
      kind: "composition",
      props: {},
      compositionRef: id,
      start: span.start,
      sourceIn: 0,
      duration: span.end - span.start,
      linkId,
    }));

    ctx.mutate(store, (draft) => {
      const home = draft.compositions[homeId]!;
      const lanes = new Map<TrackId, TrackId>();
      const movedIds = new Set(moved);
      for (const trackId of home.trackOrder) {
        const source = draft.tracks[trackId]!;
        if (!source.clipIds.some((clipId) => movedIds.has(clipId))) continue;
        const copy = createId("track");
        lanes.set(trackId, copy);
        draft.tracks[copy] = {
          ...source,
          id: copy,
          compositionId: id,
          clipIds: source.clipIds.filter((clipId) => movedIds.has(clipId)),
        };
        source.clipIds = source.clipIds.filter((clipId) => !movedIds.has(clipId));
      }
      for (const clipId of moved) {
        const clip = draft.clips[clipId]!;
        clip.trackId = lanes.get(clip.trackId)!;
        clip.start -= span.start;
      }
      for (const junctionId of droppedJunctions) delete draft.junctions[junctionId];
      for (const clipId of neighbours) trimToSpan(draft.clips[clipId]!, span);
      for (const junction of Object.values(draft.junctions)) {
        const lane = movedIds.has(junction.leftClipId) ? lanes.get(junction.trackId) : undefined;
        if (lane) junction.trackId = lane;
      }
      draft.compositions[id] = {
        id,
        name: `Composition ${draft.compositionOrder.length + 1}`,
        format: home.format,
        background: home.background,
        duration: span.end - span.start,
        extendToFit: false,
        trackOrder: [...lanes.values()],
      };
      draft.compositionOrder.push(id);
      for (const clip of placement) {
        draft.clips[clip.id] = clip;
        const lane = draft.tracks[clip.trackId]!;
        lane.clipIds = sortClipIds([...lane.clipIds, clip.id], draft.clips);
      }
    });
    return { compositionId: id, clips: placement.map((clip) => clip.id) };
  },
});

import { z } from "zod";
import { CommandFailure, createId, defineCommand } from "@/core";
import {
  contains,
  projectRef,
  requireComposition,
  type Clip,
  type TrackId,
  type TrackKind,
} from "@/modules/project";
import {
  addTrack,
  findOverlap,
  freeTrack,
  minClipDuration,
  overlapError,
  sortClipIds,
  trackEnd,
} from "@/modules/timeline";

/**
 * Places a composition as a clip: a picture and a linked sound clip, always both, because
 * placements are live and sound added inside later must be heard here.
 */
export const placeComposition = defineCommand({
  id: "composition.place",
  label: "Place composition",
  description:
    "Places a composition inside your open composition, or the one trackId belongs to, as a picture clip and a linked sound clip. It stays a live mirror: editing the original changes every placement. Each placement keeps its own position, size, rotation, trim and transitions. Optional: start (microseconds, defaults to the end of the track), trackId, audioTrackId. Fails with composition.cycle when that would put a composition inside itself. Returns { clips } (ids, picture first).",
  undoable: true,
  input: z.object({
    compositionId: z.string(),
    start: z.number().int().min(0).optional().describe("Microseconds"),
    trackId: z.string().optional(),
    audioTrackId: z.string().optional(),
  }),
  async run(ctx, input) {
    const project = ctx.require(projectRef);
    let state = project.store.getState();
    const placed = requireComposition(state, input.compositionId);
    const named = { trackId: input.trackId, audioTrackId: input.audioTrackId };
    const track = named.trackId ? state.tracks[named.trackId] : undefined;
    if (named.trackId && !track) {
      throw new CommandFailure("timeline.track_not_found", `No track with id "${named.trackId}"`);
    }
    const home = track
      ? requireComposition(state, track.compositionId)
      : project.view.requireOpen(ctx.actor);
    if (contains(state, input.compositionId, home.id)) {
      throw new CommandFailure(
        "composition.cycle",
        `"${placed.name}" can't go inside "${home.name}": a composition can't contain itself.`,
      );
    }
    const { duration } = placed;
    if (duration < minClipDuration(home.format)) {
      throw new CommandFailure("timeline.too_short", "The clip would be shorter than one frame");
    }

    const wanted: Partial<Record<TrackKind, TrackId>> = {};
    if (track) wanted[track.kind] = track.id;
    if (named.audioTrackId) wanted.audio = named.audioTrackId;
    const firstVideo = home.trackOrder.find((id) => state.tracks[id]?.kind === "video");
    const startTrack = wanted.video ?? firstVideo;
    const start = input.start ?? (startTrack ? trackEnd(state, startTrack) : 0);

    const trackIds: TrackId[] = [];
    for (const kind of ["video", "audio"] as const) {
      const chosen = wanted[kind] ?? (kind === "video" ? firstVideo : undefined);
      if (chosen) {
        const overlap = findOverlap(state, chosen, start, duration);
        if (overlap) throw overlapError(state, overlap);
        trackIds.push(chosen);
        continue;
      }
      let free = freeTrack(state, home, kind, start, duration);
      if (!free) {
        free = (await ctx.execute(addTrack, { kind, compositionId: home.id })).trackId;
        state = project.store.getState();
      }
      trackIds.push(free);
    }

    const linkId = createId("link");
    const clips: Clip[] = trackIds.map((trackId) => ({
      id: createId("clip"),
      trackId,
      kind: "composition",
      props: {},
      compositionRef: input.compositionId,
      start,
      sourceIn: 0,
      duration,
      linkId,
    }));
    ctx.mutate(project.store, (draft) => {
      for (const clip of clips) {
        draft.clips[clip.id] = clip;
        const lane = draft.tracks[clip.trackId]!;
        lane.clipIds = sortClipIds([...lane.clipIds, clip.id], draft.clips);
      }
    });
    return { clips: clips.map((clip) => clip.id) };
  },
});

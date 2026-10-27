import { z } from "zod";
import { CommandFailure, createId, defineCommand, formatTimecode } from "@/core";
import { mediaRef } from "@/modules/media";
import { type Clip, projectRef } from "@/modules/project";
import {
  clampTrim,
  findOverlap,
  minClipDuration,
  neighbourBounds,
  sortClipIds,
  trackEnd,
} from "./logic/placement";
import { mediaDuration, overlapError, requireClip, requireTrack, time } from "./timeline.guards";
import { addTrack } from "./timeline.track.commands";

/**
 * Places a media item on the timeline. Defaults: the first track of the matching kind (one is
 * created if none exists), right after the last clip on it, using the whole file.
 */
export const addClip = defineCommand({
  id: "timeline.addClip",
  label: "Add clip",
  description:
    "Places imported media on the timeline. Optional: trackId (must match the media kind), start (defaults to the end of the track), sourceIn and duration to use only part of the file. Fails if the spot overlaps another clip. Returns the new clip.",
  undoable: true,
  input: z.object({
    mediaId: z.string(),
    trackId: z.string().optional(),
    start: time.optional(),
    sourceIn: time.optional(),
    duration: z.number().int().positive().optional().describe("Microseconds"),
  }),
  async run(ctx, input) {
    let state = ctx.require(projectRef).store.getState();
    const media = state.media[input.mediaId];
    if (!media) throw new CommandFailure("media.not_found", `No media with id "${input.mediaId}"`);
    const total = mediaDuration(ctx.require(mediaRef), media.id);

    let trackId = input.trackId;
    if (trackId) {
      const track = requireTrack(state, trackId);
      if (track.kind !== media.kind) {
        throw new CommandFailure(
          "timeline.kind_mismatch",
          `"${media.name}" is ${media.kind}; it cannot go on the ${track.kind} track "${track.name}".`,
        );
      }
    } else {
      trackId = state.trackOrder.find((id) => state.tracks[id]?.kind === media.kind);
      if (!trackId) {
        trackId = (await ctx.execute(addTrack, { kind: media.kind })).trackId;
        state = ctx.require(projectRef).store.getState();
      }
    }

    const sourceIn = input.sourceIn ?? 0;
    if (sourceIn >= total) {
      throw new CommandFailure("timeline.out_of_range", "sourceIn is past the end of the media");
    }
    const duration = Math.min(input.duration ?? total - sourceIn, total - sourceIn);
    if (duration < minClipDuration(state)) {
      throw new CommandFailure("timeline.too_short", "The clip would be shorter than one frame");
    }
    const start = input.start ?? trackEnd(state, trackId);
    const overlap = findOverlap(state, trackId, start, duration);
    if (overlap) throw overlapError(state, overlap);

    const clip: Clip = {
      id: createId("clip"),
      trackId,
      mediaId: media.id,
      start,
      sourceIn,
      duration,
    };
    ctx.mutate(ctx.require(projectRef).store, (draft) => {
      draft.clips[clip.id] = clip;
      const track = draft.tracks[clip.trackId]!;
      track.clipIds = sortClipIds([...track.clipIds, clip.id], draft.clips);
    });
    return clip;
  },
});

/** Moves a clip in time and, optionally, to another track of the same kind. */
export const moveClip = defineCommand({
  id: "timeline.moveClip",
  label: "Move clip",
  description:
    "Moves a clip to a new start time and optionally to another track of the same kind. Fails if it would overlap another clip.",
  undoable: true,
  input: z.object({ clipId: z.string(), start: time, trackId: z.string().optional() }),
  run(ctx, { clipId, start, trackId }) {
    const state = ctx.require(projectRef).store.getState();
    const clip = requireClip(state, clipId);
    const targetId = trackId ?? clip.trackId;
    const target = requireTrack(state, targetId);
    const source = requireTrack(state, clip.trackId);
    if (target.kind !== source.kind) {
      throw new CommandFailure(
        "timeline.kind_mismatch",
        `A ${source.kind} clip cannot move to the ${target.kind} track "${target.name}".`,
      );
    }
    const overlap = findOverlap(state, targetId, start, clip.duration, new Set([clipId]));
    if (overlap) throw overlapError(state, overlap);

    ctx.mutate(ctx.require(projectRef).store, (draft) => {
      const moved = draft.clips[clipId]!;
      moved.start = start;
      if (targetId !== moved.trackId) {
        const from = draft.tracks[moved.trackId]!;
        from.clipIds = from.clipIds.filter((id) => id !== clipId);
        draft.tracks[targetId]!.clipIds.push(clipId);
        moved.trackId = targetId;
      }
      const to = draft.tracks[targetId]!;
      to.clipIds = sortClipIds(to.clipIds, draft.clips);
    });
    return ctx.require(projectRef).store.getState().clips[clipId];
  },
});

/**
 * Moves one edge of a clip. The result is clamped: a clip never grows past its source media,
 * never overlaps its neighbours, and never gets shorter than one frame.
 */
export const trimClip = defineCommand({
  id: "timeline.trimClip",
  label: "Trim clip",
  description:
    'Moves the "start" or "end" edge of a clip to a timeline time. Clamped to the source media length, the neighbouring clips, and a one-frame minimum. Returns the resulting clip.',
  undoable: true,
  input: z.object({ clipId: z.string(), edge: z.enum(["start", "end"]), time }),
  run(ctx, { clipId, edge, time: to }) {
    const state = ctx.require(projectRef).store.getState();
    const clip = requireClip(state, clipId);
    const next = clampTrim(clip, edge, to, {
      mediaDuration:
        ctx.require(mediaRef).getProbe(clip.mediaId)?.duration ?? Number.POSITIVE_INFINITY,
      minDuration: minClipDuration(state),
      ...neighbourBounds(state, clip),
    });
    ctx.mutate(ctx.require(projectRef).store, (draft) => {
      Object.assign(draft.clips[clipId]!, next);
    });
    return ctx.require(projectRef).store.getState().clips[clipId];
  },
});

/** Splits clips in two at a time. */
export const splitAt = defineCommand({
  id: "timeline.splitAt",
  label: "Split",
  description:
    "Splits clips in two at a timeline time. Pass clipIds to split only those; otherwise every clip under that time is split. Returns the ids of the new right-hand clips.",
  undoable: true,
  input: z.object({ at: time, clipIds: z.array(z.string()).optional() }),
  run(ctx, { at, clipIds }) {
    const state = ctx.require(projectRef).store.getState();
    const min = minClipDuration(state);
    const candidates = clipIds
      ? clipIds.map((id) => requireClip(state, id))
      : Object.values(state.clips);
    const targets = candidates.filter(
      (clip) => at - clip.start >= min && clip.start + clip.duration - at >= min,
    );
    if (targets.length === 0) {
      throw new CommandFailure(
        "timeline.nothing_to_split",
        `No clip can be split at ${formatTimecode(at)}`,
      );
    }

    const created: string[] = [];
    ctx.mutate(ctx.require(projectRef).store, (draft) => {
      for (const target of targets) {
        const left = draft.clips[target.id]!;
        const offset = at - left.start;
        const right: Clip = {
          id: createId("clip"),
          trackId: left.trackId,
          mediaId: left.mediaId,
          start: at,
          sourceIn: left.sourceIn + offset,
          duration: left.duration - offset,
          ...(left.transform && { transform: { ...left.transform } }),
        };
        left.duration = offset;
        draft.clips[right.id] = right;
        const track = draft.tracks[left.trackId]!;
        track.clipIds = sortClipIds([...track.clipIds, right.id], draft.clips);
        created.push(right.id);
      }
    });
    return { created };
  },
});

/** Deletes clips. */
export const deleteClips = defineCommand({
  id: "timeline.deleteClips",
  label: "Delete",
  description: "Deletes clips from the timeline (the media stays in the library).",
  undoable: true,
  input: z.object({ clipIds: z.array(z.string()).min(1) }),
  run(ctx, { clipIds }) {
    const state = ctx.require(projectRef).store.getState();
    clipIds.forEach((id) => requireClip(state, id));
    const doomed = new Set(clipIds);
    ctx.mutate(ctx.require(projectRef).store, (draft) => {
      for (const id of clipIds) {
        const clip = draft.clips[id];
        if (!clip) continue;
        const track = draft.tracks[clip.trackId];
        if (track) track.clipIds = track.clipIds.filter((c) => !doomed.has(c));
        delete draft.clips[id];
      }
    });
    return { deleted: clipIds.length };
  },
});

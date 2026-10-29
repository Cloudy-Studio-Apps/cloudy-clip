import { z } from "zod";
import { CommandFailure, createId, defineCommand, formatTimecode } from "@/core";
import { mediaHasAudio, mediaRef } from "@/modules/media";
import {
  type Clip,
  type TrackId,
  type TrackKind,
  partnersOf,
  projectRef,
  withPartners,
} from "@/modules/project";
import {
  clampTrim,
  findOverlap,
  freeTrack,
  minClipDuration,
  sortClipIds,
  trackEnd,
} from "./logic/placement";
import { linkedTrimEdge, trimLimits } from "./logic/trim";
import { mediaDuration, overlapError, requireClip, requireTrack, time } from "./timeline.guards";
import { addTrack } from "./timeline.track.commands";

/**
 * Places a media item on the timeline. A video file becomes a picture clip on a video track and,
 * if it has sound, a linked sound clip on an audio track. Defaults: right after the last clip on
 * the first track of the main kind, on that track (the sound on the first audio track with room
 * there; a track is created when needed), using the whole file.
 */
export const addClip = defineCommand({
  id: "timeline.addClip",
  label: "Add clip",
  description:
    "Places imported media on the timeline. A video file becomes a picture clip on a video track plus, if it has sound, a linked sound clip on an audio track (linked clips move, trim, split and delete together until unlinked). Optional: trackId (a track of either kind; for an audio file it must be an audio track), audioTrackId (where a video's sound goes), start (defaults to the end of the first track of the main kind), sourceIn and duration to use only part of the file. Fails if a named track is busy at that spot. Returns { clips } (picture first).",
  undoable: true,
  input: z.object({
    mediaId: z.string(),
    trackId: z.string().optional(),
    audioTrackId: z.string().optional(),
    start: time.optional(),
    sourceIn: time.optional(),
    duration: z.number().int().positive().optional().describe("Microseconds"),
  }),
  async run(ctx, input) {
    let state = ctx.require(projectRef).store.getState();
    const media = state.media[input.mediaId];
    if (!media) throw new CommandFailure("media.not_found", `No media with id "${input.mediaId}"`);
    const mediaApi = ctx.require(mediaRef);
    const total = mediaDuration(mediaApi, media.id);
    const kinds: TrackKind[] =
      media.kind === "audio"
        ? ["audio"]
        : mediaHasAudio(mediaApi.getProbe(media.id))
          ? ["video", "audio"]
          : ["video"];

    // Tracks the caller asked for, by kind.
    const named: Partial<Record<TrackKind, TrackId>> = {};
    if (input.trackId) {
      const track = requireTrack(state, input.trackId);
      if (media.kind === "audio" && track.kind !== "audio") {
        throw new CommandFailure(
          "timeline.kind_mismatch",
          `"${media.name}" is audio; it cannot go on the ${track.kind} track "${track.name}".`,
        );
      }
      named[track.kind] = track.id;
    }
    if (input.audioTrackId) {
      const track = requireTrack(state, input.audioTrackId);
      if (track.kind !== "audio") {
        throw new CommandFailure(
          "timeline.kind_mismatch",
          `audioTrackId must be an audio track; "${track.name}" is a ${track.kind} track.`,
        );
      }
      named.audio = track.id;
    }

    const sourceIn = input.sourceIn ?? 0;
    if (sourceIn >= total) {
      throw new CommandFailure("timeline.out_of_range", "sourceIn is past the end of the media");
    }
    const duration = Math.min(input.duration ?? total - sourceIn, total - sourceIn);
    if (duration < minClipDuration(state)) {
      throw new CommandFailure("timeline.too_short", "The clip would be shorter than one frame");
    }
    const main = kinds[0]!;
    const mainTrack = named[main] ?? state.trackOrder.find((id) => state.tracks[id]?.kind === main);
    const start = input.start ?? (mainTrack ? trackEnd(state, mainTrack) : 0);

    const trackIds: TrackId[] = [];
    for (const kind of kinds) {
      // The main clip keeps the usual rule (first track of its kind) unless the caller aimed at
      // a track of the other kind (a video dropped on an audio lane); the sound finds room.
      const aimedElsewhere = input.trackId !== undefined && named[main] === undefined;
      const wanted = named[kind] ?? (kind === main && !aimedElsewhere ? mainTrack : undefined);
      if (wanted) {
        const overlap = findOverlap(state, wanted, start, duration);
        if (overlap) throw overlapError(state, overlap);
        trackIds.push(wanted);
        continue;
      }
      let trackId = freeTrack(state, kind, start, duration);
      if (!trackId) {
        trackId = (await ctx.execute(addTrack, { kind })).trackId;
        state = ctx.require(projectRef).store.getState();
      }
      trackIds.push(trackId);
    }

    const linkId = trackIds.length > 1 ? createId("link") : undefined;
    const clips: Clip[] = trackIds.map((trackId) => ({
      id: createId("clip"),
      trackId,
      kind: "media",
      props: {},
      mediaId: media.id,
      start,
      sourceIn,
      duration,
      ...(linkId && { linkId }),
    }));
    ctx.mutate(ctx.require(projectRef).store, (draft) => {
      for (const clip of clips) {
        draft.clips[clip.id] = clip;
        const track = draft.tracks[clip.trackId]!;
        track.clipIds = sortClipIds([...track.clipIds, clip.id], draft.clips);
      }
    });
    return { clips };
  },
});

/**
 * Moves a clip in time and, optionally, to another track of the same kind. Linked clips move by
 * the same offset and stay on their own tracks.
 */
export const moveClip = defineCommand({
  id: "timeline.moveClip",
  label: "Move clip",
  description:
    "Moves a clip to a new start time and optionally to another track of the same kind. Linked clips (a video's picture and sound) move by the same offset on their own tracks. Fails, changing nothing, if any of them would overlap another clip.",
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
    const delta = start - clip.start;
    const group = [clip, ...partnersOf(state, clipId)];
    const ignore = new Set(group.map((c) => c.id));
    const moves = group.map((c) => ({
      clip: c,
      start: c.start + delta,
      trackId: c.id === clipId ? targetId : c.trackId,
    }));
    for (const move of moves) {
      if (move.start < 0) {
        throw new CommandFailure(
          "timeline.out_of_range",
          "A linked clip would start before the beginning of the timeline",
        );
      }
      const overlap = findOverlap(state, move.trackId, move.start, move.clip.duration, ignore);
      if (overlap) throw overlapError(state, overlap);
    }

    ctx.mutate(ctx.require(projectRef).store, (draft) => {
      for (const move of moves) {
        const moved = draft.clips[move.clip.id]!;
        moved.start = move.start;
        if (move.trackId !== moved.trackId) {
          const from = draft.tracks[moved.trackId]!;
          from.clipIds = from.clipIds.filter((id) => id !== moved.id);
          draft.tracks[move.trackId]!.clipIds.push(moved.id);
          moved.trackId = move.trackId;
        }
        const to = draft.tracks[move.trackId]!;
        to.clipIds = sortClipIds(to.clipIds, draft.clips);
      }
    });
    return ctx.require(projectRef).store.getState().clips[clipId];
  },
});

/**
 * Moves one edge of a clip. The result is clamped: a clip never grows past its source media,
 * never overlaps its neighbours, and never gets shorter than one frame. Linked clips get the
 * same edge (the tightest of their limits).
 */
export const trimClip = defineCommand({
  id: "timeline.trimClip",
  label: "Trim clip",
  description:
    'Moves the "start" or "end" edge of a clip to a timeline time. Clamped to the source media length, the neighbouring clips, and a one-frame minimum. Linked clips (a video\'s picture and sound) are trimmed to the same edge, the tightest of their limits. Returns the resulting clip.',
  undoable: true,
  input: z.object({ clipId: z.string(), edge: z.enum(["start", "end"]), time }),
  run(ctx, { clipId, edge, time: to }) {
    const state = ctx.require(projectRef).store.getState();
    const clip = requireClip(state, clipId);
    const media = ctx.require(mediaRef);
    const durationOf = (id: string) => media.getProbe(id)?.duration;
    const group = [clip, ...partnersOf(state, clipId)];
    const edgeTime = linkedTrimEdge(state, group, edge, to, durationOf);
    const results = group.map((c) => ({
      id: c.id,
      next: clampTrim(c, edge, edgeTime, trimLimits(state, c, durationOf)),
    }));
    ctx.mutate(ctx.require(projectRef).store, (draft) => {
      for (const { id, next } of results) Object.assign(draft.clips[id]!, next);
    });
    return ctx.require(projectRef).store.getState().clips[clipId];
  },
});

/** Splits clips in two at a time. */
export const splitAt = defineCommand({
  id: "timeline.splitAt",
  label: "Split",
  description:
    "Splits clips in two at a timeline time. Pass clipIds to split only those (their linked clips are split too); otherwise every clip under that time is split. Linked halves stay linked: left with left, right with right. Returns the ids of the new right-hand clips.",
  undoable: true,
  input: z.object({ at: time, clipIds: z.array(z.string()).optional() }),
  run(ctx, { at, clipIds }) {
    const state = ctx.require(projectRef).store.getState();
    const min = minClipDuration(state);
    if (clipIds) clipIds.forEach((id) => requireClip(state, id));
    const candidates = clipIds
      ? withPartners(state, clipIds).map((id) => requireClip(state, id))
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

    // Right halves of one linked pair share a new link.
    const rightLinks = new Map<string, string>();
    const created: string[] = [];
    ctx.mutate(ctx.require(projectRef).store, (draft) => {
      for (const target of targets) {
        const left = draft.clips[target.id]!;
        const offset = at - left.start;
        let linkId: string | undefined;
        if (left.linkId) {
          linkId = rightLinks.get(left.linkId) ?? createId("link");
          rightLinks.set(left.linkId, linkId);
        }
        const base = {
          id: createId("clip"),
          trackId: left.trackId,
          start: at,
          duration: left.duration - offset,
          ...(left.transform && { transform: { ...left.transform } }),
          ...(linkId && { linkId }),
        };
        // Text has no source file, so its `sourceIn` stays 0.
        const right: Clip = {
          ...base,
          kind: left.kind,
          props: structuredClone(target.props),
          ...(left.mediaId !== undefined && { mediaId: left.mediaId }),
          sourceIn: left.mediaId === undefined ? 0 : left.sourceIn + offset,
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

/** Deletes clips and their linked clips. */
export const deleteClips = defineCommand({
  id: "timeline.deleteClips",
  label: "Delete",
  description:
    "Deletes clips from the timeline (the media stays in the library). Linked clips (a video's picture and sound) are deleted together.",
  undoable: true,
  input: z.object({ clipIds: z.array(z.string()).min(1) }),
  run(ctx, { clipIds }) {
    const state = ctx.require(projectRef).store.getState();
    clipIds.forEach((id) => requireClip(state, id));
    const all = withPartners(state, clipIds);
    const doomed = new Set(all);
    ctx.mutate(ctx.require(projectRef).store, (draft) => {
      for (const id of all) {
        const clip = draft.clips[id];
        if (!clip) continue;
        const track = draft.tracks[clip.trackId];
        if (track) track.clipIds = track.clipIds.filter((c) => !doomed.has(c));
        delete draft.clips[id];
      }
    });
    return { deleted: all.length };
  },
});

/** Breaks the link between clips, so each is edited on its own. */
export const unlinkClips = defineCommand({
  id: "timeline.unlinkClips",
  label: "Unlink",
  description:
    "Unlinks clips from their linked clips (a video's picture and sound), so each can be moved, trimmed, split and deleted on its own. Undo links them again. Fails if none of the clips is linked. Returns how many clips lost their link.",
  undoable: true,
  input: z.object({ clipIds: z.array(z.string()).min(1) }),
  run(ctx, { clipIds }) {
    const state = ctx.require(projectRef).store.getState();
    clipIds.forEach((id) => requireClip(state, id));
    const linked = withPartners(state, clipIds).filter((id) => state.clips[id]?.linkId);
    if (linked.length === 0) {
      throw new CommandFailure("timeline.not_linked", "None of these clips is linked");
    }
    ctx.mutate(ctx.require(projectRef).store, (draft) => {
      for (const id of linked) delete draft.clips[id]!.linkId;
    });
    return { unlinked: linked.length };
  },
});

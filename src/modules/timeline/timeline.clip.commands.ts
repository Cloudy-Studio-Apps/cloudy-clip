import { z } from "zod";
import { CommandFailure, createId, defineCommand } from "@/core";
import { mediaHasAudio, mediaRef } from "@/modules/media";
import {
  type Clip,
  type TrackId,
  type TrackKind,
  projectRef,
  withPartners,
} from "@/modules/project";
import { findOverlap, freeTrack, minClipDuration, sortClipIds, trackEnd } from "./logic/placement";
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

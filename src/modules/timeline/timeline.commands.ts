import { z } from "zod";
import { CommandFailure, createId, defineCommand, formatTimecode, type Micros } from "@/core";
import { mediaRef, type MediaApi } from "@/modules/media";
import {
  projectStore,
  type Clip,
  type ProjectState,
  type Track,
  type TrackKind,
} from "@/modules/project";
import {
  clampTrim,
  findOverlap,
  minClipDuration,
  neighbourBounds,
  sortClipIds,
  trackEnd,
} from "./logic/placement";

const time = z.number().int().min(0).describe("Microseconds");

function requireClip(state: ProjectState, clipId: string): Clip {
  const clip = state.clips[clipId];
  if (!clip) throw new CommandFailure("timeline.clip_not_found", `No clip with id "${clipId}"`);
  return clip;
}

function requireTrack(state: ProjectState, trackId: string): Track {
  const track = state.tracks[trackId];
  if (!track) throw new CommandFailure("timeline.track_not_found", `No track with id "${trackId}"`);
  return track;
}

function mediaDuration(media: MediaApi, mediaId: string): Micros {
  const probe = media.getProbe(mediaId);
  if (probe?.status === "error") {
    throw new CommandFailure("media.unsupported", probe.error ?? "This media cannot be played");
  }
  if (probe?.status !== "ready" || probe.duration === undefined) {
    const proxy = probe?.proxy;
    const preparing =
      proxy && (proxy.state === "queued" || proxy.state === "encoding")
        ? ` It is being optimized for editing (${Math.round((proxy.progress ?? 0) * 100)}%).`
        : "";
    throw new CommandFailure(
      "media.not_ready",
      `This media is still loading.${preparing} Try again shortly.`,
    );
  }
  return probe.duration;
}

function overlapError(state: ProjectState, other: Clip): CommandFailure {
  const end = other.start + other.duration;
  return new CommandFailure(
    "timeline.overlap",
    `That spot overlaps clip "${other.id}" (${formatTimecode(other.start)}–${formatTimecode(end)}) on track "${state.tracks[other.trackId]?.name}". Pick a free spot or another track.`,
    { clipId: other.id, start: other.start, end },
  );
}

function nextTrackName(state: ProjectState, kind: TrackKind): string {
  const base = kind === "video" ? "Video" : "Audio";
  const count = Object.values(state.tracks).filter((t) => t.kind === kind).length;
  return `${base} ${count + 1}`;
}

/** Adds an empty track. New video tracks go on top (drawn above the others). */
export const addTrack = defineCommand({
  id: "timeline.addTrack",
  label: "Add track",
  description:
    "Adds an empty track. Video tracks are added at the top (their picture is drawn above lower tracks); audio tracks at the bottom. Returns the new track id.",
  undoable: true,
  input: z.object({ kind: z.enum(["video", "audio"]), name: z.string().min(1).max(60).optional() }),
  run(ctx, { kind, name }) {
    const id = createId("track");
    ctx.mutate(projectStore, (draft) => {
      draft.tracks[id] = {
        id,
        kind,
        name: name ?? nextTrackName(draft, kind),
        clipIds: [],
        muted: false,
        hidden: false,
      };
      if (kind === "video") draft.trackOrder.unshift(id);
      else draft.trackOrder.push(id);
    });
    return { trackId: id };
  },
});

/** Removes a track and every clip on it. */
export const removeTrack = defineCommand({
  id: "timeline.removeTrack",
  label: "Remove track",
  description: "Removes a track and all clips on it.",
  undoable: true,
  input: z.object({ trackId: z.string() }),
  run(ctx, { trackId }) {
    const track = requireTrack(projectStore.getState(), trackId);
    ctx.mutate(projectStore, (draft) => {
      for (const id of track.clipIds) delete draft.clips[id];
      delete draft.tracks[trackId];
      draft.trackOrder = draft.trackOrder.filter((id) => id !== trackId);
    });
  },
});

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
    let state = projectStore.getState();
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
        state = projectStore.getState();
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
    ctx.mutate(projectStore, (draft) => {
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
    const state = projectStore.getState();
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

    ctx.mutate(projectStore, (draft) => {
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
    return projectStore.getState().clips[clipId];
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
    const state = projectStore.getState();
    const clip = requireClip(state, clipId);
    const next = clampTrim(clip, edge, to, {
      mediaDuration:
        ctx.require(mediaRef).getProbe(clip.mediaId)?.duration ?? Number.POSITIVE_INFINITY,
      minDuration: minClipDuration(state),
      ...neighbourBounds(state, clip),
    });
    ctx.mutate(projectStore, (draft) => {
      Object.assign(draft.clips[clipId]!, next);
    });
    return projectStore.getState().clips[clipId];
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
    const state = projectStore.getState();
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
    ctx.mutate(projectStore, (draft) => {
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
    const state = projectStore.getState();
    clipIds.forEach((id) => requireClip(state, id));
    const doomed = new Set(clipIds);
    ctx.mutate(projectStore, (draft) => {
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

/** Mutes or unmutes a track. */
export const setTrackMuted = defineCommand({
  id: "timeline.setTrackMuted",
  label: "Mute track",
  description: "Mutes or unmutes every clip on a track.",
  undoable: true,
  input: z.object({ trackId: z.string(), muted: z.boolean() }),
  run(ctx, { trackId, muted }) {
    requireTrack(projectStore.getState(), trackId);
    ctx.mutate(projectStore, (draft) => {
      draft.tracks[trackId]!.muted = muted;
    });
  },
});

/** Hides or shows a track's picture. */
export const setTrackHidden = defineCommand({
  id: "timeline.setTrackHidden",
  label: "Hide track",
  description: "Hides or shows the picture of a video track in the preview.",
  undoable: true,
  input: z.object({ trackId: z.string(), hidden: z.boolean() }),
  run(ctx, { trackId, hidden }) {
    requireTrack(projectStore.getState(), trackId);
    ctx.mutate(projectStore, (draft) => {
      draft.tracks[trackId]!.hidden = hidden;
    });
  },
});

export const timelineCommands = [
  addTrack,
  removeTrack,
  addClip,
  moveClip,
  trimClip,
  splitAt,
  deleteClips,
  setTrackMuted,
  setTrackHidden,
];

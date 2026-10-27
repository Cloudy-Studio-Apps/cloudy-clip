import { z } from "zod";
import { createId, defineCommand } from "@/core";
import { type ProjectState, type TrackKind, projectRef } from "@/modules/project";
import { requireTrack } from "./timeline.guards";

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
    ctx.mutate(ctx.require(projectRef).store, (draft) => {
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
    const track = requireTrack(ctx.require(projectRef).store.getState(), trackId);
    ctx.mutate(ctx.require(projectRef).store, (draft) => {
      for (const id of track.clipIds) delete draft.clips[id];
      delete draft.tracks[trackId];
      draft.trackOrder = draft.trackOrder.filter((id) => id !== trackId);
    });
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
    requireTrack(ctx.require(projectRef).store.getState(), trackId);
    ctx.mutate(ctx.require(projectRef).store, (draft) => {
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
    requireTrack(ctx.require(projectRef).store.getState(), trackId);
    ctx.mutate(ctx.require(projectRef).store, (draft) => {
      draft.tracks[trackId]!.hidden = hidden;
    });
  },
});

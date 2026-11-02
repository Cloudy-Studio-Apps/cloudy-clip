import { z } from "zod";
import { CommandFailure, createId, defineCommand } from "@/core";
import { produce } from "immer";
import {
  findLayoutConflict,
  orderedTracks,
  projectRef,
  type ProjectState,
  type TrackKind,
} from "@/modules/project";
import { requireTrack } from "./timeline.guards";

function nextTrackName(state: ProjectState, compositionId: string, kind: TrackKind): string {
  const base = kind === "video" ? "Video" : "Audio";
  const count = orderedTracks(state, compositionId).filter((t) => t.kind === kind).length;
  return `${base} ${count + 1}`;
}

/** Adds an empty track at `index`; without one, video goes on top and audio at the bottom. */
export const addTrack = defineCommand({
  id: "timeline.addTrack",
  label: "Add track",
  description:
    "Adds an empty track to your open composition, or to compositionId. Video tracks are added at the top (their picture is drawn above lower tracks) and audio tracks at the bottom, unless you pass index: its place in the track order, 0 being the top. Returns the new track id.",
  undoable: true,
  input: z.object({
    kind: z.enum(["video", "audio"]),
    index: z.number().int().min(0).optional(),
    name: z.string().min(1).max(60).optional(),
    compositionId: z.string().optional(),
  }),
  run(ctx, { kind, index, name, compositionId }) {
    const id = createId("track");
    const project = ctx.require(projectRef);
    const home = compositionId ?? project.view.requireOpen(ctx.actor).id;
    if (!project.store.getState().compositions[home]) {
      throw new CommandFailure("composition.not_found", `No composition with id "${home}"`);
    }
    ctx.mutate(project.store, (draft) => {
      draft.tracks[id] = {
        id,
        compositionId: home,
        kind,
        name: name ?? nextTrackName(draft, home, kind),
        clipIds: [],
        muted: false,
        hidden: false,
      };
      const { trackOrder } = draft.compositions[home]!;
      const at = index ?? (kind === "video" ? 0 : trackOrder.length);
      trackOrder.splice(Math.min(at, trackOrder.length), 0, id);
    });
    return { trackId: id };
  },
});

/** Removes a track and every clip on it, and the junctions of those clips. */
export const removeTrack = defineCommand({
  id: "timeline.removeTrack",
  label: "Remove track",
  description:
    "Removes a track and all clips on it, and the junctions (transitions) of those clips. Fails with timeline.remove_joined when the clips' linked clips on other tracks would be left overlapping under a junction: remove the transitions on that track first. Returns { removedJunctions }.",
  undoable: true,
  input: z.object({ trackId: z.string() }),
  run(ctx, { trackId }) {
    const state = ctx.require(projectRef).store.getState();
    const track = requireTrack(state, trackId);
    const doomed = new Set(track.clipIds);
    const removedJunctions = Object.values(state.junctions)
      .filter((j) => doomed.has(j.leftClipId) || doomed.has(j.rightClipId))
      .map((j) => j.id);
    const apply = (draft: ProjectState) => {
      for (const id of doomed) delete draft.clips[id];
      for (const id of removedJunctions) delete draft.junctions[id];
      delete draft.tracks[trackId];
      const composition = draft.compositions[track.compositionId]!;
      composition.trackOrder = composition.trackOrder.filter((id) => id !== trackId);
    };
    const conflict = findLayoutConflict(produce(state, apply));
    if (conflict) {
      throw new CommandFailure(
        "timeline.remove_joined",
        `Removing track "${track.name}" would leave clips "${conflict.clip.id}" and "${conflict.other.id}" overlapping under a transition that is removed with it. Remove the transitions on that track first.`,
        { clipId: conflict.other.id },
      );
    }
    ctx.mutate(ctx.require(projectRef).store, apply);
    return { removedJunctions };
  },
});

/** Mutes or unmutes an audio track. */
export const setTrackMuted = defineCommand({
  id: "timeline.setTrackMuted",
  label: "Mute track",
  description:
    "Mutes or unmutes every clip on an audio track. Video tracks have no sound (a video's sound is on an audio track), so muting one fails.",
  undoable: true,
  input: z.object({ trackId: z.string(), muted: z.boolean() }),
  run(ctx, { trackId, muted }) {
    const track = requireTrack(ctx.require(projectRef).store.getState(), trackId);
    if (track.kind !== "audio") {
      throw new CommandFailure(
        "timeline.kind_mismatch",
        "Video tracks have no sound; mute the audio track.",
      );
    }
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

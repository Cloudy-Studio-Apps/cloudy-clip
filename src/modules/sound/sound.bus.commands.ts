import { z } from "zod";
import { CommandFailure, createId, defineCommand } from "@/core";
import {
  compositionMixOf,
  minimizeTrackMix,
  orderedTracks,
  projectRef,
  trackMixOf,
  volumeDbSchema,
  type BusId,
  type MixBus,
  type TrackMix,
} from "@/modules/project";
import { audioTrack, requireBus } from "./sound.guards";
import { targetComposition, writeComposition, writeTrack } from "./sound.mix.write";
import { closesLoop, listensOf } from "./logic/effects";

const compositionId = z.string().optional().describe("The composition (default: your open one).");

/** A track's mix sending to `busId` (Master when null). */
function sentTo(mix: TrackMix, busId: BusId | null): TrackMix {
  const next = { ...mix };
  delete next.busId;
  return busId === null ? next : { ...next, busId };
}

/** `Group n` with the first n no group of `buses` is called yet. */
function nextGroupName(buses: readonly MixBus[]): string {
  const taken = new Set(buses.map((bus) => bus.name));
  let n = 1;
  while (taken.has(`Group ${n}`)) n++;
  return `Group ${n}`;
}

/** Adds a group track to a composition. */
export const addBus = defineCommand({
  id: "sound.addBus",
  label: "Add group",
  description:
    "Adds a group track to your open composition (or compositionId): a mixer strip that audio tracks send to (sound_send_to) and that sends to Master. Without a name it is the first free Group n (Group 1, Group 2…). It starts at 0 dB, unmuted, with no effects (give it a chain with sound_add_effect, target the returned id). trackIds (audio tracks of that composition) send to it in the same step. Returns { busId }. Fails with sound.track_not_found, sound.not_audio.",
  undoable: true,
  input: z.object({
    compositionId,
    name: z.string().trim().min(1).max(64).optional(),
    trackIds: z.array(z.string()).optional(),
  }),
  run(ctx, { compositionId: comp, name, trackIds = [] }) {
    const { store } = ctx.require(projectRef);
    const id = targetComposition(ctx, comp);
    const state = store.getState();
    // A new group has no effects and nothing listens to it, so sending to it can't make a loop.
    const tracks = [...new Set(trackIds)].map((trackId) => audioTrack(state, trackId));
    const stranger = tracks.find((track) => track.compositionId !== id);
    if (stranger) {
      throw new CommandFailure(
        "sound.track_not_found",
        `Track "${stranger.name}" isn't in that composition.`,
      );
    }
    const known = compositionMixOf(state.compositions[id]!).buses ?? [];
    const bus: MixBus = {
      id: createId("bus"),
      name: name ?? nextGroupName(known),
      volumeDb: 0,
      muted: false,
    };
    ctx.mutate(store, (draft) => {
      for (const track of tracks) {
        writeTrack(draft.tracks[track.id]!, sentTo(trackMixOf(track), bus.id));
      }
      const composition = draft.compositions[id]!;
      const mix = compositionMixOf(composition);
      // Groups are shared structure: the other mix has the group too, at the defaults.
      const other = mix.otherMix && {
        ...mix.otherMix,
        buses: [...(mix.otherMix.buses ?? []), { ...bus }],
      };
      writeComposition(composition, {
        ...mix,
        buses: [...(mix.buses ?? []), bus],
        ...(other && { otherMix: other }),
      });
    });
    return { busId: bus.id };
  },
});

/** Changes a group's name, volume or mute. */
export const setBus = defineCommand({
  id: "sound.setBus",
  label: "Change group",
  description:
    "Changes a group track: name, volumeDb (-60 to 12) and muted. Only the fields in patch change; the name is the same in both mixes A and B, the volume and mute belong to the active mix. A muted group silences every track sent to it. Fails with sound.bus_not_found.",
  undoable: true,
  input: z.object({
    compositionId,
    busId: z.string(),
    patch: z.object({
      name: z.string().trim().min(1).max(64).optional(),
      volumeDb: volumeDbSchema.optional(),
      muted: z.boolean().optional(),
    }),
  }),
  run(ctx, { compositionId: comp, busId, patch }) {
    const { store } = ctx.require(projectRef);
    const id = targetComposition(ctx, comp);
    requireBus(store.getState(), id, busId);
    ctx.mutate(store, (draft) => {
      const composition = draft.compositions[id]!;
      const mix = compositionMixOf(composition);
      const defined = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
      // The name is shared by both mixes; the volume and the mute are this mix's own.
      const other = mix.otherMix?.buses && {
        ...mix.otherMix,
        buses: mix.otherMix.buses.map((b) =>
          b.id === busId && patch.name !== undefined ? { ...b, name: patch.name } : b,
        ),
      };
      writeComposition(composition, {
        ...mix,
        buses: (mix.buses ?? []).map((b) => (b.id === busId ? { ...b, ...defined } : b)),
        ...(other && { otherMix: other }),
      });
    });
  },
});

/** Takes a group away; its tracks go to Master. */
export const removeBus = defineCommand({
  id: "sound.removeBus",
  label: "Remove group",
  description:
    "Removes a group track. The tracks sent to it send to Master again (in both mixes, A and B), and ducks that listened to it stop listening to it; one undo brings all of it back. Fails with sound.bus_not_found.",
  undoable: true,
  input: z.object({ compositionId, busId: z.string() }),
  run(ctx, { compositionId: comp, busId }) {
    const { store } = ctx.require(projectRef);
    const id = targetComposition(ctx, comp);
    requireBus(store.getState(), id, busId);
    ctx.mutate(store, (draft) => {
      for (const track of orderedTracks(draft, id)) {
        if (track.kind === "audio" && track.mix?.busId === busId) {
          writeTrack(track, sentTo(trackMixOf(track), null));
        }
      }
      const composition = draft.compositions[id]!;
      const mix = compositionMixOf(composition);
      // The other mix is stored as lean as the live one: no entry at the defaults, no empty list.
      const { otherMix } = mix;
      const rest = otherMix?.buses?.filter((b) => b.id !== busId);
      const other = otherMix && {
        master: otherMix.master,
        tracks: Object.fromEntries(
          Object.entries(otherMix.tracks).flatMap(([trackId, m]) => {
            const kept = minimizeTrackMix(m.busId === busId ? sentTo(m, null) : m);
            return kept ? [[trackId, kept]] : [];
          }),
        ),
        ...(rest?.length && { buses: rest }),
      };
      // Ducks that listened to the group are dropped by the project's settle, in this same step.
      writeComposition(composition, {
        ...mix,
        buses: (mix.buses ?? []).filter((b) => b.id !== busId),
        ...(other && { otherMix: other }),
      });
    });
  },
});

/** Sends audio tracks to a group, or back to Master. */
export const sendTo = defineCommand({
  id: "sound.sendTo",
  label: "Send to",
  description:
    "Chooses where audio tracks send their sound: a group (busId) or Master (busId null). Every track must belong to the composition that has the group. Fails with sound.bus_not_found, sound.not_audio, sound.track_not_found, and sound.duck_loop when a track ducked by that group (or by something it feeds) would end up feeding it.",
  undoable: true,
  input: z.object({ trackIds: z.array(z.string()).min(1), busId: z.string().nullable() }),
  run(ctx, { trackIds, busId }) {
    const { store } = ctx.require(projectRef);
    const state = store.getState();
    const unique = [...new Set(trackIds)];
    const tracks = unique.map((trackId) => audioTrack(state, trackId));
    if (busId !== null) {
      for (const track of tracks) requireBus(state, track.compositionId, busId);
      // The same graph with the new sends: a track must not end up depending on the group it feeds.
      const next = { ...state.tracks };
      for (const track of tracks)
        next[track.id] = { ...track, mix: sentTo(trackMixOf(track), busId) };
      for (const track of tracks) {
        const buses = compositionMixOf(state.compositions[track.compositionId]!).buses ?? [];
        if (closesLoop(next, track.id, listensOf(track), buses)) {
          throw new CommandFailure(
            "sound.duck_loop",
            `Sending "${track.name}" to that group would make a loop: it is lowered by the group or by something the group feeds.`,
          );
        }
      }
    }
    ctx.mutate(store, (draft) => {
      for (const track of tracks) {
        writeTrack(draft.tracks[track.id]!, sentTo(trackMixOf(track), busId));
      }
    });
  },
});

/** Every group command, for the module. */
export const soundBusCommands = [addBus, setBus, removeBus, sendTo];

import { z } from "zod";
import { CommandFailure, createId, defineCommand } from "@/core";
import {
  compositionMixOf,
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

/** Adds a group track to a composition. */
export const addBus = defineCommand({
  id: "sound.addBus",
  label: "Add group",
  description:
    "Adds a group track to your open composition (or compositionId): a mixer strip that audio tracks send to (sound_send_to) and that sends to Master. It starts at 0 dB, unmuted, with no effects (give it a chain with sound_add_effect, target the returned id). Returns { busId }.",
  undoable: true,
  input: z.object({ compositionId, name: z.string().trim().min(1).max(64) }),
  run(ctx, { compositionId: comp, name }) {
    const { store } = ctx.require(projectRef);
    const id = targetComposition(ctx, comp);
    const bus: MixBus = { id: createId("bus"), name, volumeDb: 0, muted: false };
    ctx.mutate(store, (draft) => {
      const composition = draft.compositions[id]!;
      const mix = compositionMixOf(composition);
      writeComposition(composition, { ...mix, buses: [...(mix.buses ?? []), bus] });
    });
    return { busId: bus.id };
  },
});

/** Changes a group's name, volume or mute. */
export const setBus = defineCommand({
  id: "sound.setBus",
  label: "Change group",
  description:
    "Changes a group track: name, volumeDb (-60 to 12) and muted. Only the fields in patch change. A muted group silences every track sent to it. Fails with sound.bus_not_found.",
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
      writeComposition(composition, {
        ...mix,
        buses: (mix.buses ?? []).map((b) => (b.id === busId ? { ...b, ...defined } : b)),
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
      const other = mix.otherMix && {
        ...mix.otherMix,
        tracks: Object.fromEntries(
          Object.entries(mix.otherMix.tracks).map(([trackId, m]) => [
            trackId,
            m.busId === busId ? sentTo(m, null) : m,
          ]),
        ),
        buses: mix.otherMix.buses?.filter((b) => b.id !== busId),
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

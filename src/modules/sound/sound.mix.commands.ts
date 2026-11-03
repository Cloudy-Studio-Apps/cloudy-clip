import { z } from "zod";
import { defineCommand } from "@/core";
import {
  DEFAULT_TRACK_MIX,
  compositionMixOf,
  orderedTracks,
  panSchema,
  projectRef,
  trackMixOf,
  volumeDbSchema,
  type CompositionId,
  type MixSnapshot,
  type ProjectState,
} from "@/modules/project";
import { audioTrack } from "./sound.guards";
import { targetComposition, writeComposition, writeTrack } from "./sound.mix.write";

/** The live mix of a composition: its audio tracks' mixes (those at the defaults left out). */
function liveMix(state: ProjectState, compositionId: CompositionId): MixSnapshot {
  const tracks: MixSnapshot["tracks"] = {};
  for (const track of orderedTracks(state, compositionId)) {
    if (track.kind === "audio" && track.mix) tracks[track.id] = trackMixOf(track);
  }
  return { tracks, master: compositionMixOf(state.compositions[compositionId]!).master };
}

/** Sets how an audio track sounds in the mix. */
export const setTrackMix = defineCommand({
  id: "sound.setTrackMix",
  label: "Change track mix",
  description:
    "Changes how an audio track sounds in the mix: volumeDb (-60 to 12) and pan (-1 left to 1 right). Only the values you pass change. Fails with sound.not_audio on a video track and sound.track_not_found.",
  undoable: true,
  input: z.object({
    trackId: z.string(),
    volumeDb: volumeDbSchema.optional(),
    pan: panSchema.optional(),
  }),
  run(ctx, { trackId, volumeDb, pan }) {
    const { store } = ctx.require(projectRef);
    const track = audioTrack(store.getState(), trackId);
    ctx.mutate(store, (draft) => {
      const next = { ...trackMixOf(track) };
      if (volumeDb !== undefined) next.volumeDb = volumeDb;
      if (pan !== undefined) next.pan = pan;
      writeTrack(draft.tracks[trackId]!, next);
    });
  },
});

/** Puts an audio track's mix back to the defaults. */
export const resetTrackMix = defineCommand({
  id: "sound.resetTrackMix",
  label: "Reset track mix",
  description:
    "Puts an audio track's volume and pan back to 0 dB and centre; its effects stay. Fails with sound.not_audio on a video track and sound.track_not_found.",
  undoable: true,
  input: z.object({ trackId: z.string() }),
  run(ctx, { trackId }) {
    const { store } = ctx.require(projectRef);
    const track = audioTrack(store.getState(), trackId);
    ctx.mutate(store, (draft) => {
      const effects = trackMixOf(track).effects;
      writeTrack(draft.tracks[trackId]!, effects && { ...DEFAULT_TRACK_MIX, effects });
    });
  },
});

/** Sets the master volume of a composition. */
export const setMaster = defineCommand({
  id: "sound.setMaster",
  label: "Change master volume",
  description:
    "Sets the master volume (volumeDb, -60 to 12) of your open composition, or of compositionId. It applies to the whole composition's sound.",
  undoable: true,
  input: z.object({ compositionId: z.string().optional(), volumeDb: volumeDbSchema }),
  run(ctx, { compositionId, volumeDb }) {
    const { store } = ctx.require(projectRef);
    const id = targetComposition(ctx, compositionId);
    ctx.mutate(store, (draft) => {
      const composition = draft.compositions[id]!;
      const mix = compositionMixOf(composition);
      // Only the volume: whatever else the master holds stays.
      writeComposition(composition, { ...mix, master: { ...mix.master, volumeDb } });
    });
  },
});

/** Switches a composition between its two mixes, A and B. */
export const switchMix = defineCommand({
  id: "sound.switchMix",
  label: "Switch mix",
  description:
    'Switches your open composition (or compositionId) to mix "a" or "b": every audio track\'s volume, pan and effects, and the master, are swapped with those of the other mix. The first time, B starts as a copy of A. Switching to the mix that is active does nothing.',
  undoable: true,
  input: z.object({ compositionId: z.string().optional(), to: z.enum(["a", "b"]) }),
  run(ctx, { compositionId, to }) {
    const { store } = ctx.require(projectRef);
    const id = targetComposition(ctx, compositionId);
    const state = store.getState();
    const current = compositionMixOf(state.compositions[id]!);
    if (current.activeMix === to) return;
    const live = liveMix(state, id);
    const incoming = current.otherMix ?? live;
    ctx.mutate(store, (draft) => {
      for (const track of orderedTracks(draft, id)) {
        if (track.kind === "audio") writeTrack(track, incoming.tracks[track.id]);
      }
      writeComposition(draft.compositions[id]!, {
        master: incoming.master,
        activeMix: to,
        otherMix: live,
      });
    });
  },
});

/** Every mix command, for the module. */
export const soundMixCommands = [setTrackMix, resetTrackMix, setMaster, switchMix];

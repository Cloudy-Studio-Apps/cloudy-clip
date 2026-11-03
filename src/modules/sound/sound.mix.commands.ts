import { z } from "zod";
import { CommandFailure, defineCommand, type CommandContext } from "@/core";
import {
  DEFAULT_COMPOSITION_MIX,
  compositionMixOf,
  minimize,
  minimizeTrackMix,
  orderedTracks,
  panSchema,
  projectRef,
  requireComposition,
  trackMixOf,
  volumeDbSchema,
  type CompositionId,
  type CompositionMix,
  type MixSnapshot,
  type ProjectState,
  type Track,
  type TrackId,
} from "@/modules/project";

/** The audio track with this id, or the failure to throw. */
function audioTrack(state: ProjectState, trackId: TrackId): Track {
  const track = state.tracks[trackId];
  if (!track) throw new CommandFailure("sound.track_not_found", `No track with id "${trackId}"`);
  if (track.kind !== "audio") {
    throw new CommandFailure(
      "sound.not_audio",
      `Track "${trackId}" is a video track: it has no mix.`,
    );
  }
  return track;
}

/** Writes a track's mix, or removes it at the defaults. */
function writeTrack(track: Track, mix: Track["mix"]): void {
  const next = mix && minimizeTrackMix(mix);
  if (next) track.mix = next;
  else delete track.mix;
}

/** Writes a composition's mix, or removes it at the defaults. */
function writeComposition(composition: { mix?: CompositionMix }, mix: CompositionMix): void {
  const next = minimize(mix, DEFAULT_COMPOSITION_MIX);
  if (next) composition.mix = next;
  else delete composition.mix;
}

/** The composition: given, or the one the actor has open. */
function targetComposition(ctx: CommandContext, compositionId: CompositionId | undefined) {
  const project = ctx.require(projectRef);
  const id = compositionId ?? project.view.requireOpen(ctx.actor).id;
  return requireComposition(project.store.getState(), id).id;
}

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
    "Puts an audio track's volume and pan back to 0 dB and centre. Fails with sound.not_audio on a video track and sound.track_not_found.",
  undoable: true,
  input: z.object({ trackId: z.string() }),
  run(ctx, { trackId }) {
    const { store } = ctx.require(projectRef);
    audioTrack(store.getState(), trackId);
    ctx.mutate(store, (draft) => writeTrack(draft.tracks[trackId]!, undefined));
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
      writeComposition(composition, {
        ...compositionMixOf(composition),
        master: { volumeDb },
      });
    });
  },
});

/** Switches a composition between its two mixes, A and B. */
export const switchMix = defineCommand({
  id: "sound.switchMix",
  label: "Switch mix",
  description:
    'Switches your open composition (or compositionId) to mix "a" or "b": every audio track\'s volume and pan, and the master, are swapped with those of the other mix. The first time, B starts as a copy of A. Switching to the mix that is active does nothing.',
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

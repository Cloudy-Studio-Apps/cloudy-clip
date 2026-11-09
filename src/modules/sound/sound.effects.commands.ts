import { z } from "zod";
import { CommandFailure, createId, defineCommand, type CommandContext } from "@/core";
import {
  SOUND_EFFECT_KINDS,
  compositionMixOf,
  requireComposition,
  effectSchemas,
  projectRef,
  trackMixOf,
  type BusId,
  type CompositionId,
  type CompositionMix,
  type MixBus,
  type ProjectState,
  type SoundEffect,
  type TrackId,
} from "@/modules/project";
import { audioTrack } from "./sound.guards";
import { targetComposition, writeComposition, writeTrack } from "./sound.mix.write";
import { closesLoop, defaultSpec } from "./logic/effects";
import { BUILT_IN_PRESETS } from "./logic/presets";
import { soundRef } from "./sound.ref";

const target = z
  .union([z.string(), z.literal("master")])
  .describe('An audio track id, a group id (from sound_add_bus), or "master".');
const compositionId = z
  .string()
  .optional()
  .describe("For the master or a group: the composition (default: your open one).");

function notFound(effectId: string): CommandFailure {
  return new CommandFailure("sound.effect_not_found", `No effect with id "${effectId}" there.`);
}

/** A track or group that owns a chain, as `checkDuck` reads it. */
interface DuckOwner {
  id: TrackId | BusId;
  name: string;
  compositionId: CompositionId;
}

/** Checks a duck's `listensTo` (audio tracks and groups of the same composition) and that it closes no loop. */
function checkDuck(state: ProjectState, owner: DuckOwner, effect: SoundEffect): void {
  if (effect.kind !== "duck") return;
  const composition = state.compositions[owner.compositionId]!;
  const buses = compositionMixOf(composition).buses ?? [];
  for (const id of effect.listensTo) {
    const heard = state.tracks[id];
    const ok = heard
      ? heard.kind === "audio" && heard.compositionId === owner.compositionId
      : buses.some((b) => b.id === id);
    if (!ok) {
      throw new CommandFailure(
        "sound.track_not_found",
        `"${id}" is not an audio track or a group of the same composition.`,
      );
    }
  }
  if (closesLoop(state.tracks, owner.id, effect.listensTo, buses)) {
    throw new CommandFailure(
      "sound.duck_loop",
      `Ducking "${owner.name}" under those would make a loop: one of them is "${owner.name}" or is itself lowered by it.`,
    );
  }
}

/** Writes a new chain on a group of a composition. */
function writeBusChain(
  composition: { mix?: CompositionMix },
  busId: BusId,
  effects: SoundEffect[],
): void {
  const mix = compositionMixOf(composition);
  writeComposition(composition, {
    ...mix,
    buses: (mix.buses ?? []).map((b: MixBus) => (b.id === busId ? { ...b, effects } : b)),
  });
}

/**
 * Edits the chain of a track, a group or the master in one step: `edit` gets the current chain,
 * the state and the owner (undefined on the master) and returns the new chain (or throws). An
 * empty chain is not stored.
 */
function editChain(
  ctx: CommandContext,
  who: TrackId | BusId | "master",
  compositionIdInput: string | undefined,
  edit: (chain: SoundEffect[], state: ProjectState, owner: DuckOwner | undefined) => SoundEffect[],
): void {
  const { store } = ctx.require(projectRef);
  const state = store.getState();
  const noDuckOnMaster = (chain: SoundEffect[]) => {
    if (chain.some((e) => e.kind === "duck")) {
      throw new CommandFailure(
        "sound.duck_on_master",
        "The master cannot duck: every track feeds it, so whatever it listened to would loop.",
      );
    }
    return chain;
  };
  if (who === "master") {
    const id = targetComposition(ctx, compositionIdInput);
    const mix = compositionMixOf(state.compositions[id]!);
    const effects = noDuckOnMaster(edit([...(mix.master.effects ?? [])], state, undefined));
    ctx.mutate(store, (draft) =>
      writeComposition(draft.compositions[id]!, { ...mix, master: { ...mix.master, effects } }),
    );
    return;
  }
  if (!state.tracks[who]) {
    // Not a track: a group of the composition, else the track failure.
    const id = targetComposition(ctx, compositionIdInput);
    const bus = compositionMixOf(requireComposition(state, id)).buses?.find((b) => b.id === who);
    if (bus) {
      const owner = { id: bus.id, name: bus.name, compositionId: id };
      const effects = edit([...(bus.effects ?? [])], state, owner);
      ctx.mutate(store, (draft) => writeBusChain(draft.compositions[id]!, bus.id, effects));
      return;
    }
  }
  const track = audioTrack(state, who);
  const owner = { id: track.id, name: track.name, compositionId: track.compositionId };
  const effects = edit([...(trackMixOf(track).effects ?? [])], state, owner);
  ctx.mutate(store, (draft) => writeTrack(draft.tracks[who]!, { ...trackMixOf(track), effects }));
}

/** Adds an effect of a kind, with its default settings, to a chain. */
export const addEffect = defineCommand({
  id: "sound.addEffect",
  label: "Add effect",
  description:
    "Adds an effect to the chain of an audio track, of a group or of \"master\" (the open composition's, or compositionId; a group is found in that composition). kind is eq, compressor, gate, deesser, limiter, denoise or duck; it starts at the kind's defaults (change it with sound_set_effect). `at` is the position in the chain (default: the end). A chain holds one effect of each kind: fails with sound.effect_exists. A duck on master fails with sound.duck_on_master. Returns { effectId }. Fails with sound.not_audio and sound.track_not_found. A group takes the same chain as a track (a duck there may listen to tracks and groups).",
  undoable: true,
  input: z.object({
    target,
    compositionId,
    kind: z.enum(SOUND_EFFECT_KINDS),
    at: z.number().int().min(0).optional(),
  }),
  run(ctx, { target: who, compositionId: comp, kind, at }) {
    const effect: SoundEffect = { ...defaultSpec(kind), id: createId("fx") };
    editChain(ctx, who, comp, (chain) => {
      if (chain.some((e) => e.kind === kind)) {
        throw new CommandFailure("sound.effect_exists", `The chain already has a ${kind}.`);
      }
      chain.splice(Math.min(at ?? chain.length, chain.length), 0, effect);
      return chain;
    });
    return { effectId: effect.id };
  },
});

/** Changes the settings of an effect. */
export const setEffect = defineCommand({
  id: "sound.setEffect",
  label: "Change effect",
  description:
    'Changes the settings of an effect in the chain of an audio track, a group or "master". patch holds only the fields to change, by kind: on (any); eq: bands (six); compressor: params { thresholdDb -60..0, ratio 1..20, attackMs, releaseMs, kneeDb 0..18, makeupDb 0..36 } (any of them); gate: thresholdDb -80..0, ratio 1..20, attackMs, releaseMs; deesser: frequencyHz 2000..12000, amount 0..1; limiter: ceilingDb -20..0, releaseMs 1..8000; denoise: amountDb 0..40, floorDb -80..-20; duck: listensTo (track and group ids), depthDb -40..0, attackMs, releaseMs. Out-of-range values, unknown fields (nested ones too) and a track listed twice fail with sound.effect_invalid; a duck that would make a loop fails with sound.duck_loop. Fails with sound.effect_not_found.',
  undoable: true,
  input: z.object({
    target,
    compositionId,
    effectId: z.string(),
    patch: z.record(z.string(), z.unknown()),
  }),
  run(ctx, { target: who, compositionId: comp, effectId, patch }) {
    editChain(ctx, who, comp, (chain, state, owner) => {
      const index = chain.findIndex((e) => e.id === effectId);
      const current = chain[index];
      if (!current) throw notFound(effectId);
      if ("id" in patch || "kind" in patch) {
        throw new CommandFailure("sound.effect_invalid", "An effect's id and kind cannot change.");
      }
      const { params, ...rest } = patch;
      const merged: Record<string, unknown> = { ...current, ...rest };
      if (params !== undefined) {
        const plain = typeof params === "object" && params !== null && !Array.isArray(params);
        merged.params =
          current.kind === "compressor" && plain ? { ...current.params, ...params } : params;
      }
      const parsed = effectSchemas[current.kind].safeParse(merged);
      if (!parsed.success) {
        throw new CommandFailure(
          "sound.effect_invalid",
          parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
        );
      }
      const next = parsed.data as SoundEffect;
      if (owner) checkDuck(state, owner, next);
      chain[index] = next;
      return chain;
    });
  },
});

/** Takes an effect out of a chain. */
export const removeEffect = defineCommand({
  id: "sound.removeEffect",
  label: "Remove effect",
  description:
    'Removes an effect from the chain of an audio track, a group or "master". Fails with sound.effect_not_found.',
  undoable: true,
  input: z.object({ target, compositionId, effectId: z.string() }),
  run(ctx, { target: who, compositionId: comp, effectId }) {
    editChain(ctx, who, comp, (chain) => {
      if (!chain.some((e) => e.id === effectId)) throw notFound(effectId);
      return chain.filter((e) => e.id !== effectId);
    });
  },
});

/** Moves an effect to another place in its chain. */
export const moveEffect = defineCommand({
  id: "sound.moveEffect",
  label: "Move effect",
  description:
    'Moves an effect to position `to` (0 is first; past the end means last) in the chain of an audio track, a group or "master". Fails with sound.effect_not_found.',
  undoable: true,
  input: z.object({ target, compositionId, effectId: z.string(), to: z.number().int().min(0) }),
  run(ctx, { target: who, compositionId: comp, effectId, to }) {
    editChain(ctx, who, comp, (chain) => {
      const from = chain.findIndex((e) => e.id === effectId);
      if (from < 0) throw notFound(effectId);
      const [effect] = chain.splice(from, 1);
      chain.splice(Math.min(to, chain.length), 0, effect!);
      return chain;
    });
  },
});

/** Replaces a chain with a preset's. */
export const applyPreset = defineCommand({
  id: "sound.applyPreset",
  label: "Apply sound preset",
  description:
    "Replaces the whole chain of an audio track, a group or \"master\" with a preset's effects: a built-in one or one of the user's (list them with sound_list_presets). The values are written plainly, so the project never depends on the preset. One undo step brings the old chain back. Fails with sound.preset_not_found; a preset with ducking fails on master with sound.duck_on_master, and on a track whose composition lacks the tracks it listens to (sound.track_not_found) or where it would loop (sound.duck_loop).",
  undoable: true,
  input: z.object({ target, compositionId, presetId: z.string() }),
  run(ctx, { target: who, compositionId: comp, presetId }) {
    // The built-in ones first: they need nothing but this module's code.
    const preset =
      BUILT_IN_PRESETS.find((p) => p.id === presetId) ??
      ctx
        .require(soundRef)
        .presets.getState()
        .presets.find((p) => p.id === presetId);
    if (!preset) {
      throw new CommandFailure("sound.preset_not_found", `No preset with id "${presetId}".`);
    }
    editChain(ctx, who, comp, (_chain, state, owner) => {
      const chain = preset.effects.map((spec): SoundEffect =>
        structuredClone({ ...spec, id: createId("fx") }),
      );
      // A user's preset comes from storage the user can edit: its ducks are checked as any are.
      if (owner) for (const effect of chain) checkDuck(state, owner, effect);
      return chain;
    });
  },
});

/** Every effect command, for the module. */
export const soundEffectCommands = [addEffect, setEffect, removeEffect, moveEffect, applyPreset];

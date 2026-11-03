import { z } from "zod";
import { CommandFailure, createId, defineCommand } from "@/core";
import { projectRef } from "@/modules/project";
import { audioTrack } from "./sound.guards";
import { targetComposition } from "./sound.mix.write";
import { chainOf } from "./logic/effects";
import { soundRef } from "./sound.ref";
import type { EffectSpec } from "./sound.types";

const name = z.string().trim().min(1).max(60).describe("The preset's name, 1 to 60 characters.");

function notFound(presetId: string): CommandFailure {
  return new CommandFailure(
    "sound.preset_not_found",
    `No preset of yours with id "${presetId}"; the built-in ones can't change.`,
  );
}

/**
 * Keeps the chain of a track or the master as one of the user's presets. Outside the project, so
 * never undone, and no MCP tool: the user's presets are theirs (agents list and apply them).
 */
export const savePreset = defineCommand({
  id: "sound.savePreset",
  label: "Save sound preset",
  description:
    "Keeps the effects of an audio track or \"master\" (the open composition's, or compositionId) as one of the user's presets, with a name. A duck keeps its settings but listens to no track, since tracks belong to one project. Not undoable. Fails with sound.preset_empty when the chain has no effects, and sound.not_audio, sound.track_not_found.",
  undoable: false,
  input: z.object({
    target: z.union([z.string(), z.literal("master")]),
    compositionId: z.string().optional(),
    name,
  }),
  run(ctx, { target, compositionId, name: presetName }) {
    const state = ctx.require(projectRef).store.getState();
    const composition = target === "master" ? targetComposition(ctx, compositionId) : undefined;
    if (target !== "master") audioTrack(state, target);
    const chain = chainOf(state, target, composition);
    if (chain.length === 0) {
      throw new CommandFailure("sound.preset_empty", "There are no effects to keep.");
    }
    const effects = chain.map(({ id: _id, ...spec }) =>
      structuredClone(spec.kind === "duck" ? { ...spec, listensTo: [] } : spec),
    ) as EffectSpec[];
    const presetId = createId("preset");
    const { presets } = ctx.require(soundRef);
    presets.setState({
      presets: [
        ...presets.getState().presets,
        { id: presetId, name: presetName, description: "", effects },
      ],
    });
    return { presetId };
  },
});

/** Renames one of the user's presets. */
export const renamePreset = defineCommand({
  id: "sound.renamePreset",
  label: "Rename sound preset",
  description:
    "Renames one of the user's presets. Not undoable. Fails with sound.preset_not_found (built-in presets can't change).",
  undoable: false,
  input: z.object({ presetId: z.string(), name }),
  run(ctx, { presetId, name: presetName }) {
    const { presets } = ctx.require(soundRef);
    const list = presets.getState().presets;
    if (!list.some((preset) => preset.id === presetId)) throw notFound(presetId);
    presets.setState({
      presets: list.map((preset) =>
        preset.id === presetId ? { ...preset, name: presetName } : preset,
      ),
    });
  },
});

/** Removes one of the user's presets. Chains it was applied to keep their values. */
export const removePreset = defineCommand({
  id: "sound.removePreset",
  label: "Remove sound preset",
  description:
    "Removes one of the user's presets; chains it was applied to keep their values. Not undoable. Fails with sound.preset_not_found (built-in presets can't change).",
  undoable: false,
  input: z.object({ presetId: z.string() }),
  run(ctx, { presetId }) {
    const { presets } = ctx.require(soundRef);
    const list = presets.getState().presets;
    if (!list.some((preset) => preset.id === presetId)) throw notFound(presetId);
    presets.setState({ presets: list.filter((preset) => preset.id !== presetId) });
  },
});

/** The commands on the user's own presets, for the module. */
export const soundPresetCommands = [savePreset, renamePreset, removePreset];

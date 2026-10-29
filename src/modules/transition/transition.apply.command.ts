import { z } from "zod";
import { CommandFailure, defineCommand, type CommandContext } from "@/core";
import { cutAfter, cutNear, addJunction, setJunction, type Cut } from "@/modules/junction";
import { junctionBetween, projectRef, type Junction, type ProjectState } from "@/modules/project";
import { transitionRef } from "./transition.ref";

const micros = z.number().int().min(0).describe("Microseconds");

/** The cut an `apply` input names, or a `junction.no_cut` failure. */
function findCut(state: ProjectState, input: z.output<typeof applyInput>): Cut {
  if (input.junctionId !== undefined) {
    const junction = state.junctions[input.junctionId];
    if (!junction) {
      throw new CommandFailure("junction.not_found", `No junction with id "${input.junctionId}"`);
    }
    const left = state.clips[junction.leftClipId];
    const right = state.clips[junction.rightClipId];
    if (left && right) return { trackId: junction.trackId, left, right };
  } else if (input.clipId !== undefined) {
    const cut = cutAfter(state, input.clipId);
    if (cut) return cut;
  } else if (input.leftClipId !== undefined && input.rightClipId !== undefined) {
    const left = state.clips[input.leftClipId];
    const right = state.clips[input.rightClipId];
    if (left && right && left.trackId === right.trackId) {
      const cut = cutNear(state, left.trackId, right.start, Math.max(right.start - left.start, 1));
      if (cut?.left.id === left.id && cut.right.id === right.id) return cut;
    }
  } else if (input.trackId !== undefined && input.at !== undefined) {
    const cut = cutNear(state, input.trackId, input.at, Math.ceil(1_000_000 / state.format.fps));
    if (cut) return cut;
  } else {
    throw new CommandFailure(
      "junction.no_cut",
      "Name the cut: junctionId, clipId (the cut after it), leftClipId and rightClipId, or trackId and at.",
    );
  }
  throw new CommandFailure("junction.no_cut", "No two clips touch there.");
}

const applyInput = z.object({
  preset: z.string().describe("Preset id (see transition_list_presets)"),
  junctionId: z.string().optional(),
  clipId: z.string().optional().describe("The cut at the end of this clip"),
  leftClipId: z.string().optional(),
  rightClipId: z.string().optional(),
  trackId: z.string().optional(),
  at: micros.optional().describe("Time near the cut, microseconds"),
  duration: micros.optional().describe("Overlap of the clips, microseconds"),
  options: z.record(z.string(), z.unknown()).optional(),
});

/** Puts a transition on a cut, or changes the one that is there. */
async function run(ctx: CommandContext, input: z.output<typeof applyInput>): Promise<Junction> {
  if (!ctx.require(transitionRef).find(input.preset)) {
    const known = ctx
      .require(transitionRef)
      .list()
      .map((p) => p.id);
    throw new CommandFailure(
      "transition.unknown_preset",
      `No transition preset "${input.preset}". Available: ${known.join(", ") || "none"}.`,
    );
  }
  const store = ctx.require(projectRef).store;
  const cut = findCut(store.getState(), input);
  const existing = junctionBetween(store.getState(), cut.left.id, cut.right.id);
  let id: string;
  if (!existing) {
    const added = await ctx.execute(addJunction, {
      kind: "transition",
      leftClipId: cut.left.id,
      rightClipId: cut.right.id,
      props: { preset: input.preset, options: input.options ?? {} },
      ...(input.duration !== undefined && { duration: input.duration }),
    });
    id = added.id;
  } else {
    if (existing.kind !== "transition") {
      throw new CommandFailure(
        "junction.exists",
        `These clips already have junction "${existing.id}" (${existing.kind}); remove it first.`,
      );
    }
    id = existing.id;
    // A changed preset drops the old options; the new ones come in a second step.
    await ctx.execute(setJunction, {
      junctionIds: [id],
      patch: { preset: input.preset },
      ...(input.duration !== undefined && { duration: input.duration }),
    });
    if (input.options && Object.keys(input.options).length > 0) {
      await ctx.execute(setJunction, { junctionIds: [id], patch: { options: input.options } });
    }
  }
  return store.getState().junctions[id]!;
}

/**
 * Applies a transition preset to a cut between two adjacent clips of a video track: adds a
 * transition (0.5 s overlap by default), or, when the cut already has one, changes its preset
 * (old options dropped) and keeps its duration. One undo step.
 */
export const applyTransition = defineCommand({
  id: "transition.apply",
  label: "Apply transition",
  description:
    "Puts a transition preset (see transition_list_presets) on a cut: name it by junctionId, clipId (the cut after that clip), leftClipId and rightClipId, or trackId and a time `at` near it. The right clip and everything after it shift earlier by the overlap (`duration`, default 0.5 s). If the cut already has a transition, its preset changes, old options are dropped, and its duration stays unless `duration` is given. `options` are the preset's own values. Returns the junction.",
  undoable: true,
  input: applyInput,
  run,
});

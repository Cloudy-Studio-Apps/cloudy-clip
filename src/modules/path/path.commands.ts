import { z } from "zod";
import { CommandFailure, createId, defineCommand } from "@/core";
import { previewRef } from "@/modules/preview";
import { bakeFollow, projectRef, type MotionPath, type ProjectState } from "@/modules/project";
import { attachPath } from "./path.follow.commands";
import { pathPoints } from "./path.schema";

/** The path, or `path.not_found`. */
export function requirePath(state: ProjectState, pathId: string): MotionPath {
  const path = state.paths?.[pathId];
  if (!path) throw new CommandFailure("path.not_found", `No path "${pathId}".`);
  return path;
}

/** Draws a motion path on a composition's frame, optionally with clips following it at once. */
export const createPath = defineCommand({
  id: "path.create",
  label: "Draw path",
  description:
    'Adds a motion path to a composition (default: the one you have open). Points are in output pixels from the frame\'s center (the space of transform.x/y), each with handles inX/inY and outX/outY as offsets from it (0 = a corner); segments are cubic Béziers, and "closed" joins the last point back to the first. "attach" lists clips that start following it in the same step (see path_attach). Fails with path.composition_not_found. Returns { pathId }.',
  undoable: true,
  input: z.object({
    compositionId: z.string().optional(),
    name: z.string().trim().min(1).optional(),
    closed: z.boolean().default(false),
    points: pathPoints,
    attach: z.array(z.string()).optional(),
  }),
  async run(ctx, input) {
    const { store, view } = ctx.require(projectRef);
    const state = store.getState();
    const composition = input.compositionId
      ? state.compositions[input.compositionId]
      : view.requireOpen(ctx.actor);
    if (!composition) {
      throw new CommandFailure(
        "path.composition_not_found",
        `No composition "${input.compositionId}".`,
      );
    }
    const count = Object.values(state.paths ?? {}).filter(
      (p) => p.compositionId === composition.id,
    ).length;
    const id = createId("path");
    ctx.mutate(store, (draft) => {
      draft.paths ??= {};
      draft.paths[id] = {
        id,
        compositionId: composition.id,
        name: input.name ?? `Path ${count + 1}`,
        closed: input.closed,
        points: input.points,
      };
    });
    if (input.attach?.length) await ctx.execute(attachPath, { clipIds: input.attach, pathId: id });
    return { pathId: id };
  },
});

/** Reshapes, renames, opens or closes a path; every clip on it moves with it. */
export const updatePath = defineCommand({
  id: "path.update",
  label: "Edit path",
  description:
    "Changes a path's points (replaced whole), name or closed; give at least one. Every clip following it moves with it. Fails with path.not_found and path.nothing.",
  undoable: true,
  input: z.object({
    pathId: z.string(),
    points: pathPoints.optional(),
    name: z.string().trim().min(1).optional(),
    closed: z.boolean().optional(),
  }),
  run(ctx, { pathId, ...changes }) {
    const { store } = ctx.require(projectRef);
    requirePath(store.getState(), pathId);
    const given = Object.entries(changes).filter(([, value]) => value !== undefined);
    if (given.length === 0) throw new CommandFailure("path.nothing", "Nothing to change.");
    ctx.mutate(store, (draft) => {
      Object.assign(draft.paths![pathId]!, Object.fromEntries(given));
    });
  },
});

/** Deletes paths; the clips on them stay where they are at `at`. */
export const removePaths = defineCommand({
  id: "path.remove",
  label: "Delete path",
  description:
    'Deletes paths, all or none. Clips following one stop following it and stay where they were at "at" (timeline microseconds, default your playhead, brought into each clip): the path\'s position (and direction, with orient) there is added to their position and rotation and to every key of them, and their Progress keys go. Fails with path.not_found.',
  undoable: true,
  input: z.object({ pathIds: z.array(z.string()).min(1), at: z.number().int().min(0).optional() }),
  run(ctx, { pathIds, at }) {
    const { store } = ctx.require(projectRef);
    const state = store.getState();
    for (const id of pathIds) requirePath(state, id);
    const when = at ?? ctx.require(previewRef).clockFor(ctx.actor).getTime();
    const gone = new Set(pathIds);
    ctx.mutate(store, (draft) => {
      for (const clip of Object.values(state.clips)) {
        if (clip.follow && gone.has(clip.follow.pathId)) {
          draft.clips[clip.id] = bakeFollow(clip, state.paths, when);
        }
      }
      for (const id of gone) delete draft.paths![id];
      if (Object.keys(draft.paths!).length === 0) delete draft.paths;
    });
  },
});

import { z } from "zod";
import { createId, defineCommand, type CommandContext } from "@/core";
import {
  applyMoves,
  findLayoutConflict,
  formatOf,
  type Junction,
  projectRef,
  type ProjectState,
  rippleMoves,
} from "@/modules/project";
import {
  checkDuration,
  nextProps,
  overlapError,
  requireCut,
  requireJunction,
  requireKind,
  requireNoJunction,
} from "./junction.guards";
import { junctionRef } from "./junction.ref";
import { durationLimits } from "./logic/limits";

const ids = z.array(z.string()).min(1);
const micros = z.number().int().min(0).describe("Microseconds");

/** Writes the clip starts, track orders and junctions of `next` into the project (one undo step). */
function commit(ctx: CommandContext, before: ProjectState, next: ProjectState): void {
  const conflict = findLayoutConflict(next);
  if (conflict) throw overlapError(next, conflict);
  ctx.mutate(ctx.require(projectRef).store, (draft) => {
    for (const clip of Object.values(next.clips)) {
      const target = draft.clips[clip.id];
      if (target && target.start !== clip.start) target.start = clip.start;
    }
    for (const track of Object.values(next.tracks)) {
      const target = draft.tracks[track.id];
      if (target && target.clipIds.join() !== track.clipIds.join()) target.clipIds = track.clipIds;
    }
    for (const id of Object.keys(before.junctions)) {
      if (!next.junctions[id]) delete draft.junctions[id];
    }
    for (const junction of Object.values(next.junctions)) {
      if (before.junctions[junction.id] !== junction) draft.junctions[junction.id] = junction;
    }
  });
}

/**
 * Puts a junction (a transition, a plugin's) on the cut between two adjacent clips. An
 * overlapping kind pulls the right clip, every later clip on the track and their linked partners
 * earlier by its duration (the total length shrinks).
 */
export const addJunction = defineCommand({
  id: "junction.add",
  label: "Add junction",
  description:
    "Puts a junction of a kind (see junction_describe) on the cut between two adjacent clips of one track, named by leftClipId and rightClipId or by trackId and a time `at` near the cut. A kind that overlaps its clips pulls the right clip, all later clips on the track and their linked sound/picture partners earlier by `duration` (default: the kind's own); fails if something else is in the way. props are the kind's own values (see junction_describe). Returns the junction.",
  undoable: true,
  input: z.object({
    kind: z.string(),
    leftClipId: z.string().optional(),
    rightClipId: z.string().optional(),
    trackId: z.string().optional(),
    at: micros.optional(),
    props: z.record(z.string(), z.unknown()).optional(),
    duration: micros.optional().describe("Overlap of the clips, microseconds"),
  }),
  run(ctx, input): Junction {
    const state = ctx.require(projectRef).store.getState();
    const resolved = requireKind(ctx.require(junctionRef), input.kind);
    const { definition } = resolved;
    const cut = requireCut(state, { ...input, kind: definition });
    requireNoJunction(state, cut);
    const limits = durationLimits(definition, state, cut.left, cut.right);
    const duration = definition.overlap ? (input.duration ?? limits.default) : 0;
    if (definition.overlap) checkDuration(definition, duration, limits);
    const props = nextProps(resolved, formatOf(state, cut.left), {}, input.props ?? {}, {});
    const junction: Junction = {
      id: createId("junction"),
      kind: definition.kind,
      trackId: cut.trackId,
      leftClipId: cut.left.id,
      rightClipId: cut.right.id,
      duration,
      props,
    };
    const moves = duration > 0 ? rippleMoves(state, cut.right.id, -duration) : [];
    commit(ctx, state, applyMoves(state, moves, { [junction.id]: junction }));
    return junction;
  },
});

/**
 * Changes junctions: their values and their duration. A new duration moves the right clip and
 * everything after it on the track (and linked partners) by the difference.
 */
export const setJunction = defineCommand({
  id: "junction.set",
  label: "Edit junction",
  description:
    "Changes junctions by id: `patch` is a partial of the kind's values (see junction_describe), `duration` is the new overlap in microseconds (the right clip and everything after it, with linked partners, shifts by the difference; fails if something is in the way). Several ids are each changed the same way. Returns { junctions }.",
  undoable: true,
  input: z.object({
    junctionIds: ids,
    patch: z.record(z.string(), z.unknown()).optional(),
    duration: micros.optional().describe("New overlap of the clips, microseconds"),
  }),
  run(ctx, input) {
    const before = ctx.require(projectRef).store.getState();
    const api = ctx.require(junctionRef);
    let state = before;
    for (const id of new Set(input.junctionIds)) {
      const current = requireJunction(state, id);
      const resolved = requireKind(api, current.kind);
      const { definition } = resolved;
      const left = state.clips[current.leftClipId]!;
      const right = state.clips[current.rightClipId]!;
      const props =
        input.patch === undefined
          ? current.props
          : nextProps(
              resolved,
              formatOf(state, left),
              current.props,
              input.patch,
              api.resolve(current, formatOf(state, left)),
            );
      let duration = current.duration;
      if (definition.overlap && input.duration !== undefined) {
        duration = input.duration;
        checkDuration(definition, duration, durationLimits(definition, state, left, right));
      }
      const moves = rippleMoves(state, right.id, current.duration - duration);
      state = applyMoves(state, duration === current.duration ? [] : moves, {
        [id]: { ...current, props, duration },
      });
    }
    commit(ctx, before, state);
    return { junctions: [...new Set(input.junctionIds)].map((id) => state.junctions[id]!) };
  },
});

/** Removes junctions; an overlapping one gives its overlap back (later clips move later). */
export const removeJunction = defineCommand({
  id: "junction.remove",
  label: "Remove junction",
  description:
    "Removes junctions by id. A junction that overlapped its clips gives the overlap back: the right clip and everything after it on the track (with linked partners) shifts later by its duration; fails if something is in the way. Returns { removed }.",
  undoable: true,
  input: z.object({ junctionIds: ids }),
  run(ctx, input) {
    const before = ctx.require(projectRef).store.getState();
    let state = before;
    const unique = [...new Set(input.junctionIds)];
    for (const id of unique) {
      const current = requireJunction(state, id);
      const moves =
        current.duration > 0 ? rippleMoves(state, current.rightClipId, current.duration) : [];
      state = applyMoves(state, moves, { [id]: null });
    }
    commit(ctx, before, state);
    return { removed: unique.length };
  },
});

/** The junction commands, registered by the junction module. */
export const junctionCommands = [addJunction, setJunction, removeJunction];

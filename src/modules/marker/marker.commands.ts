import { z } from "zod";
import { CommandFailure, createId, defineCommand } from "@/core";
import { previewRef } from "@/modules/preview";
import {
  frameDuration,
  MARKER_COLORS,
  projectRef,
  type Marker,
  type ProjectState,
} from "@/modules/project";
import { floorToFrame } from "./logic/markers";

const time = z.number().int().min(0).describe("Microseconds on the composition's timeline");
const color = z.enum(MARKER_COLORS);

function requireMarker(state: ProjectState, markerId: string): Marker {
  const marker = state.markers[markerId];
  if (!marker) throw new CommandFailure("marker.not_found", `No marker "${markerId}".`);
  return marker;
}

/** Adds a marker: by default at your playhead, on your open composition. */
export const addMarker = defineCommand({
  id: "marker.add",
  label: "Add marker",
  description:
    "Adds a marker (a bookmark with a note and a color) to a composition. Without compositionId it goes on the one you have open; without time, at your playhead, on the frame it shows. Times past the composition's end are kept. Returns { markerId }.",
  undoable: true,
  input: z.object({
    compositionId: z.string().optional(),
    time: time.optional(),
    note: z.string().default(""),
    color: color.default("blue"),
  }),
  run(ctx, input) {
    const { store, view } = ctx.require(projectRef);
    const state = store.getState();
    const composition = input.compositionId
      ? state.compositions[input.compositionId]
      : view.requireOpen(ctx.actor);
    if (!composition) {
      throw new CommandFailure(
        "marker.composition_not_found",
        `No composition "${input.compositionId}".`,
      );
    }
    const at =
      input.time ??
      floorToFrame(
        ctx.require(previewRef).clockFor(ctx.actor).getTime(),
        frameDuration(composition.format),
      );
    const id = createId("marker");
    ctx.mutate(store, (draft) => {
      draft.markers[id] = {
        id,
        compositionId: composition.id,
        time: at,
        note: input.note,
        color: input.color,
      };
    });
    return { markerId: id };
  },
});

/** Moves a marker, or changes its note or color. */
export const updateMarker = defineCommand({
  id: "marker.update",
  label: "Edit marker",
  description:
    "Changes a marker's time, note or color; give at least one. Fails with marker.not_found for an unknown id and marker.nothing when nothing is given.",
  undoable: true,
  input: z.object({
    markerId: z.string(),
    time: time.optional(),
    note: z.string().optional(),
    color: color.optional(),
  }),
  run(ctx, { markerId, ...changes }) {
    const { store } = ctx.require(projectRef);
    requireMarker(store.getState(), markerId);
    if (changes.time === undefined && changes.note === undefined && changes.color === undefined) {
      throw new CommandFailure("marker.nothing", "Give a time, a note or a color.");
    }
    ctx.mutate(store, (draft) => {
      const marker = draft.markers[markerId]!;
      if (changes.time !== undefined) marker.time = changes.time;
      if (changes.note !== undefined) marker.note = changes.note;
      if (changes.color !== undefined) marker.color = changes.color;
    });
  },
});

/** Removes markers, all or none. */
export const removeMarker = defineCommand({
  id: "marker.remove",
  label: "Remove marker",
  description:
    "Removes markers by id, in one undo step. Fails with marker.not_found, removing none, when an id is unknown.",
  undoable: true,
  input: z.object({ markerIds: z.array(z.string()).min(1) }),
  run(ctx, { markerIds }) {
    const { store } = ctx.require(projectRef);
    const state = store.getState();
    for (const id of markerIds) requireMarker(state, id);
    ctx.mutate(store, (draft) => {
      for (const id of markerIds) delete draft.markers[id];
    });
  },
});

export const markerCommands = [addMarker, updateMarker, removeMarker];

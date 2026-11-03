import { z } from "zod";
import { CommandFailure, defineCommand } from "@/core";
import { placementsOf, projectRef, requireComposition } from "@/modules/project";
import { compositionId } from "./composition.guards";
import { cloneComposition, copyName } from "./logic/clone";

/** Copies a composition. Compositions placed inside it stay shared. */
export const duplicateComposition = defineCommand({
  id: "composition.duplicate",
  label: "Duplicate composition",
  description:
    "Copies a composition with its tracks, clips, transitions and markers. Compositions placed inside it stay shared with the original. Returns { compositionId }.",
  undoable: true,
  input: z.object({ compositionId }),
  run(ctx, { compositionId: id }) {
    const { store } = ctx.require(projectRef);
    const state = store.getState();
    const { name } = requireComposition(state, id);
    let copy = "";
    ctx.mutate(store, (draft) => {
      copy = cloneComposition(draft, id, copyName(state, name));
    });
    return { compositionId: copy };
  },
});

/** Deletes a composition and everything on its timeline, markers included. */
export const deleteComposition = defineCommand({
  id: "composition.delete",
  label: "Delete composition",
  description:
    "Deletes a composition with its tracks, clips, transitions and markers. Fails with composition.in_use while it is placed in another composition, and with composition.main while it is Main and others exist: move Main first.",
  undoable: true,
  input: z.object({ compositionId }),
  run(ctx, { compositionId: id }) {
    const { store } = ctx.require(projectRef);
    const state = store.getState();
    const composition = requireComposition(state, id);
    if (placementsOf(state, id).some((clip) => !composition.trackOrder.includes(clip.trackId))) {
      throw new CommandFailure(
        "composition.in_use",
        `"${composition.name}" is placed in another composition. Delete those clips first.`,
      );
    }
    const others = state.compositionOrder.filter((other) => other !== id);
    if (state.mainCompositionId === id && others.length > 0) {
      throw new CommandFailure(
        "composition.main",
        `"${composition.name}" is Main. Set another composition as Main first.`,
      );
    }
    ctx.mutate(store, (draft) => {
      const tracks = new Set(composition.trackOrder);
      for (const clip of Object.values(draft.clips)) {
        if (tracks.has(clip.trackId)) delete draft.clips[clip.id];
      }
      for (const junction of Object.values(draft.junctions)) {
        if (tracks.has(junction.trackId)) delete draft.junctions[junction.id];
      }
      for (const marker of Object.values(draft.markers)) {
        if (marker.compositionId === id) delete draft.markers[marker.id];
      }
      for (const trackId of tracks) delete draft.tracks[trackId];
      delete draft.compositions[id];
      draft.compositionOrder = others;
      if (draft.mainCompositionId === id) draft.mainCompositionId = null;
    });
  },
});

/** Opens a composition. Yours only: an agent never moves the user. */
export const openComposition = defineCommand({
  id: "composition.open",
  label: "Open composition",
  description:
    "Opens a composition for you: your playhead, timeline commands without a track, and captured frames then work in it. The user's view doesn't move.",
  undoable: false,
  input: z.object({ compositionId }),
  run(ctx, { compositionId: id }) {
    const { store, view } = ctx.require(projectRef);
    requireComposition(store.getState(), id);
    view.setOpen(ctx.actor, id);
  },
});

/** Closes a tab above the timeline. Nothing is lost: the composition stays in the Library. */
export const closeTab = defineCommand({
  id: "composition.closeTab",
  label: "Close tab",
  description: "Closes a composition's tab above the timeline. It stays in the Library.",
  undoable: false,
  input: z.object({ compositionId }),
  run(ctx, { compositionId: id }) {
    ctx.require(projectRef).view.closeTab(id);
  },
});

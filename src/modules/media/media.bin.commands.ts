import { z } from "zod";
import { CommandFailure, createId, defineCommand } from "@/core";
import { projectRef, type BinId, type ProjectState } from "@/modules/project";

const name = z.string().trim().min(1).max(200);

function requireBin(state: ProjectState, binId: BinId): void {
  if (!state.bins[binId]) throw new CommandFailure("media.no_bin", `No bin with id "${binId}"`);
}

/** Whether `binId` is `root` or sits somewhere under it. */
function isInside(state: ProjectState, binId: BinId | null, root: BinId): boolean {
  for (let at = binId; at !== null; at = state.bins[at]?.parentId ?? null) {
    if (at === root) return true;
  }
  return false;
}

/** Makes a bin, in Master or inside another bin. */
export const createBin = defineCommand({
  id: "media.createBin",
  label: "New bin",
  description:
    "Creates a bin in the media library, inside parentId or directly in Master. Master isn't a bin: a file with no bin sits there. Returns { binId }. Fails with media.no_bin.",
  undoable: true,
  input: z.object({ name, parentId: z.string().optional() }),
  run(ctx, { name, parentId }) {
    const { store } = ctx.require(projectRef);
    if (parentId !== undefined) requireBin(store.getState(), parentId);
    const binId = createId("bin");
    ctx.mutate(store, (draft) => {
      draft.bins[binId] = { id: binId, name, parentId: parentId ?? null };
      draft.binOrder.push(binId);
    });
    return { binId };
  },
});

/** Renames a bin. */
export const renameBin = defineCommand({
  id: "media.renameBin",
  label: "Rename bin",
  description: "Renames a bin. Fails with media.no_bin.",
  undoable: true,
  input: z.object({ binId: z.string(), name }),
  run(ctx, { binId, name }) {
    const { store } = ctx.require(projectRef);
    requireBin(store.getState(), binId);
    ctx.mutate(store, (draft) => {
      draft.bins[binId]!.name = name;
    });
  },
});

/** Removes a bin. What it holds moves up one level, so nothing disappears. */
export const deleteBin = defineCommand({
  id: "media.deleteBin",
  label: "Delete bin",
  description:
    "Deletes a bin. Its files, solids and sub-bins move to its parent (Master for a top bin), so nothing is lost. Fails with media.no_bin.",
  undoable: true,
  input: z.object({ binId: z.string() }),
  run(ctx, { binId }) {
    const { store } = ctx.require(projectRef);
    const state = store.getState();
    requireBin(state, binId);
    const parentId = state.bins[binId]!.parentId;
    ctx.mutate(store, (draft) => {
      for (const item of [...Object.values(draft.media), ...Object.values(draft.solids)]) {
        if (item.binId !== binId) continue;
        if (parentId === null) delete item.binId;
        else item.binId = parentId;
      }
      for (const bin of Object.values(draft.bins)) {
        if (bin.parentId === binId) bin.parentId = parentId;
      }
      delete draft.bins[binId];
      draft.binOrder = draft.binOrder.filter((id) => id !== binId);
    });
  },
});

/** Moves files and bins into a bin, or to Master. */
export const moveToBin = defineCommand({
  id: "media.moveToBin",
  label: "Move to bin",
  description:
    "Moves files (mediaIds) and bins (binIds) into binId, or to Master when binId is null. Fails with media.not_found, media.no_bin, or media.bin_cycle when a bin would go inside itself.",
  undoable: true,
  input: z.object({
    mediaIds: z.array(z.string()).default([]),
    binIds: z.array(z.string()).default([]),
    binId: z.string().nullable(),
  }),
  run(ctx, { mediaIds, binIds, binId }) {
    const { store } = ctx.require(projectRef);
    const state = store.getState();
    if (binId !== null) requireBin(state, binId);
    for (const id of mediaIds) {
      if (!state.media[id]) throw new CommandFailure("media.not_found", `No media "${id}"`);
    }
    for (const id of binIds) {
      requireBin(state, id);
      if (isInside(state, binId, id)) {
        throw new CommandFailure("media.bin_cycle", "A bin can't go inside itself.");
      }
    }
    ctx.mutate(store, (draft) => {
      for (const id of mediaIds) {
        if (binId === null) delete draft.media[id]!.binId;
        else draft.media[id]!.binId = binId;
      }
      for (const id of binIds) draft.bins[id]!.parentId = binId;
    });
  },
});

export const mediaBinCommands = [createBin, renameBin, deleteBin, moveToBin];

import { z } from "zod";
import { CommandFailure, createId, defineCommand } from "@/core";
import { gradientSchema } from "@/modules/element";
import { projectRef, type ProjectState } from "@/modules/project";

const name = z.string().trim().min(1).max(200);
const color = z
  .string()
  .toLowerCase()
  .regex(/^#[0-9a-f]{6}$/, "A colour is #rrggbb.");
const side = z.number().int().min(1).max(16384);
const fill = {
  fillType: z.enum(["color", "gradient"]).optional(),
  gradient: gradientSchema.optional(),
};

/** A size is both sides or neither. */
function requireBothSides(width: unknown, height: unknown): void {
  if ((width === undefined) !== (height === undefined) || (width === null) !== (height === null)) {
    throw new CommandFailure("solid.invalid_size", "Give width and height together, or neither.");
  }
}

function requireBin(state: ProjectState, binId: string | null | undefined): void {
  if (binId && !state.bins[binId]) {
    throw new CommandFailure("media.no_bin", `No bin with id "${binId}"`);
  }
}

function requireSolid(state: ProjectState, solidId: string): void {
  if (!state.solids[solidId]) {
    throw new CommandFailure("solid.not_found", `No solid color with id "${solidId}"`);
  }
}

/** Adds a solid color to the library. */
export const createSolid = defineCommand({
  id: "solid.create",
  label: "New solid color",
  description:
    'Adds a solid color to the media library, in binId or Master. Without width and height it matches the frame it is placed in. fillType "gradient" paints gradient instead of color. Put it on a timeline with timeline_add_element: kind "solid", props { fillType, color, gradient, width, height }; a clip with no width and height follows its composition. Returns { solidId }. Fails with media.no_bin or solid.invalid_size.',
  undoable: true,
  input: z.object({
    name,
    color,
    width: side.optional(),
    height: side.optional(),
    ...fill,
    binId: z.string().optional(),
  }),
  run(ctx, { binId, ...values }) {
    const { store } = ctx.require(projectRef);
    requireBothSides(values.width, values.height);
    requireBin(store.getState(), binId);
    const solidId = createId("solid");
    ctx.mutate(store, (draft) => {
      draft.solids[solidId] = {
        id: solidId,
        ...values,
        ...(binId === undefined ? {} : { binId }),
      };
      draft.solidOrder.push(solidId);
    });
    return { solidId };
  },
});

/** Changes a library solid. Clips made from it keep their own colour. */
export const updateSolid = defineCommand({
  id: "solid.update",
  label: "Change solid color",
  description:
    "Changes a library solid: name, color, fillType, gradient, width and height (both null to match the frame), or binId (null for Master). Clips made from it keep their own colour. Fails with solid.not_found, solid.invalid_size or media.no_bin.",
  undoable: true,
  input: z.object({
    solidId: z.string(),
    name: name.optional(),
    color: color.optional(),
    width: side.nullable().optional(),
    height: side.nullable().optional(),
    ...fill,
    binId: z.string().nullable().optional(),
  }),
  run(ctx, { solidId, binId, width, height, ...values }) {
    const { store } = ctx.require(projectRef);
    const state = store.getState();
    requireSolid(state, solidId);
    requireBothSides(width, height);
    requireBin(state, binId);
    ctx.mutate(store, (draft) => {
      const solid = draft.solids[solidId]!;
      Object.assign(solid, values);
      if (width === null || height === null) {
        delete solid.width;
        delete solid.height;
      } else if (width !== undefined) {
        solid.width = width;
        solid.height = height;
      }
      if (binId === null) delete solid.binId;
      else if (binId !== undefined) solid.binId = binId;
    });
  },
});

/** Removes a solid from the library. Clips made from it stay as they are. */
export const removeSolid = defineCommand({
  id: "solid.remove",
  label: "Remove solid color",
  description:
    "Removes a solid color from the library. Clips made from it keep their colour. Fails with solid.not_found.",
  undoable: true,
  input: z.object({ solidId: z.string() }),
  run(ctx, { solidId }) {
    const { store } = ctx.require(projectRef);
    requireSolid(store.getState(), solidId);
    ctx.mutate(store, (draft) => {
      delete draft.solids[solidId];
      draft.solidOrder = draft.solidOrder.filter((id) => id !== solidId);
    });
  },
});

export const solidCommands = [createSolid, updateSolid, removeSolid];

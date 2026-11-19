import { z } from "zod";
import { CommandFailure, defineCommand } from "@/core";
import {
  clampToClip,
  contentTime,
  formatOf,
  frameDuration,
  normalizeRotation,
  projectRef,
  writeKey,
  type ClipMask,
  type KeyValue,
} from "@/modules/project";
import { buildMask } from "./mask.build";
import { checkRange, requireMask, requirePictureClip } from "./mask.guards";
import { maskMode, maskNumbers, maskPatch, maskPoint } from "./mask.schema";

const PRESETS = ["rectangle", "ellipse", "star", "heart", "linear", "mirror"] as const;
const SPACE =
  "Mask space is output px from the picture's center, the picture fitted in the frame before the clip's transform.";

/** Adds a mask to picture clips: a preset shape or a path drawn from points. */
export const addMask = defineCommand({
  id: "mask.add",
  label: "Add mask",
  description: `Adds a mask to each of the picture clips (one undo step). Give exactly one of "preset" (${PRESETS.join(", ")}; centered, half the frame in size, Mirror a quarter of its height) or "points" (3 or more { x, y, inX, inY, outX, outY }, handles as offsets, 0 = a corner; a closed Bézier path). "values" may set opacity (0-1), feather (0-2000), expansion (-2000-2000), x, y, rotation, and width, height, roundness (0-1), points (3-24), inner (0.05-1) where the shape has them. "mode" is add (default), subtract, intersect or difference; "name" defaults to "Mask N". ${SPACE} Fails with mask.clip_not_found, mask.not_picture (audio clips and clips with no picture) and mask.invalid. Returns { maskIds } by clip id.`,
  undoable: true,
  input: z.object({
    clipIds: z.array(z.string()).min(1),
    preset: z.enum(PRESETS).optional(),
    points: z.array(maskPoint).optional(),
    values: maskNumbers.optional(),
    mode: maskMode.optional(),
    name: z.string().trim().min(1).optional(),
  }),
  run(ctx, { clipIds, ...rest }) {
    const { store } = ctx.require(projectRef);
    const state = store.getState();
    const masks = clipIds.map((id) => {
      const clip = requirePictureClip(ctx, state, id);
      return [id, buildMask(clip, formatOf(state, clip), rest)] as const;
    });
    ctx.mutate(store, (draft) => {
      for (const [id, mask] of masks) {
        const clip = draft.clips[id]!;
        (clip.masks ??= {})[mask.id] = mask;
        (clip.maskOrder ??= []).push(mask.id);
      }
    });
    return { maskIds: Object.fromEntries(masks.map(([id, mask]) => [id, mask.id])) };
  },
});

/** Changes a mask; a value the clip animates gets a key at `at`. */
export const updateMask = defineCommand({
  id: "mask.update",
  label: "Edit mask",
  description: `Changes a mask: name, color, on, invert, mode, opacity (0-1), feather (0-2000), expansion (-2000-2000), x, y, rotation, and in "shape" the numbers its kind has (width, height, roundness, points, inner, scale). A field the clip animates needs "at" (timeline microseconds): a key is written there; to start animating a field use keyframe_set. ${SPACE} Fails with mask.clip_not_found, mask.not_found, mask.invalid and mask.animated.`,
  undoable: true,
  input: z.object({
    clipId: z.string(),
    maskId: z.string(),
    patch: maskPatch,
    at: z.number().int().min(0).optional(),
  }),
  run(ctx, { clipId, maskId, patch, at }) {
    const { store } = ctx.require(projectRef);
    const state = store.getState();
    const clip = requirePictureClip(ctx, state, clipId);
    const mask = requireMask(clip, maskId);
    const { shape, name, color, on, invert, mode, ...numbers } = patch;
    const leaves: Array<[string, string, number]> = Object.entries(numbers).map(([k, v]) => [
      `masks.${maskId}.${k}`,
      k,
      v,
    ]);
    for (const [k, v] of Object.entries(shape ?? {})) {
      if (!(k in mask.shape) || (mask.shape.kind === "path") !== (k === "scale")) {
        throw new CommandFailure("mask.invalid", `A ${mask.shape.kind} mask has no "${k}".`);
      }
      leaves.push([`masks.${maskId}.shape.${k}`, `shape.${k}`, v]);
    }
    for (const [, field, value] of leaves) checkRange(field.replace("shape.", ""), value);
    const keyed = leaves.filter(([path]) => clip.animation?.[path]);
    if (keyed.length > 0 && at === undefined) {
      throw new CommandFailure(
        "mask.animated",
        `"${keyed[0]![0]}" is animated: pass "at" (a timeline time) to key it, or use keyframe_set`,
      );
    }
    const format = formatOf(state, clip);
    const t = at === undefined ? 0 : contentTime(clip, clampToClip(clip, at));
    const tolerance = Math.floor(frameDuration(format) / 2);
    ctx.mutate(store, (draft) => {
      const target = draft.clips[clipId]!;
      const next = target.masks![maskId]! as ClipMask & Record<string, unknown>;
      const shapeOut = next.shape as unknown as Record<string, unknown>;
      for (const [path, field, value] of leaves) {
        if (clip.animation?.[path]) {
          target.animation![path] = writeKey(clip.animation[path], t, value as KeyValue, tolerance);
        } else if (field.startsWith("shape.")) shapeOut[field.slice(6)] = value;
        else next[field] = field === "rotation" ? normalizeRotation(value) : value;
      }
      if (name !== undefined) next.name = name;
      if (color !== undefined) next.color = color;
      if (mode !== undefined) next.mode = mode;
      if (on !== undefined) {
        if (on) delete next.on;
        else next.on = false;
      }
      if (invert !== undefined) {
        if (invert) next.invert = true;
        else delete next.invert;
      }
    });
    return { clipId, maskId };
  },
});

/** Deletes masks with their key tracks; none given means all of the clip's. */
export const removeMasks = defineCommand({
  id: "mask.remove",
  label: "Delete mask",
  description:
    "Deletes masks of a clip with their keys (maskIds empty: all of its masks). Fails with mask.clip_not_found, mask.not_picture and mask.not_found.",
  undoable: true,
  input: z.object({ clipId: z.string(), maskIds: z.array(z.string()) }),
  run(ctx, { clipId, maskIds }) {
    const { store } = ctx.require(projectRef);
    const clip = requirePictureClip(ctx, store.getState(), clipId);
    const gone = new Set(maskIds.length > 0 ? maskIds : (clip.maskOrder ?? []));
    for (const id of gone) requireMask(clip, id);
    ctx.mutate(store, (draft) => {
      const target = draft.clips[clipId]!;
      for (const id of gone) delete target.masks![id];
      target.maskOrder = target.maskOrder!.filter((id) => !gone.has(id));
      if (target.maskOrder.length === 0) {
        delete target.masks;
        delete target.maskOrder;
      }
      for (const path of Object.keys(target.animation ?? {})) {
        if ([...gone].some((id) => path.startsWith(`masks.${id}.`))) delete target.animation![path];
      }
      if (target.animation && Object.keys(target.animation).length === 0) delete target.animation;
    });
  },
});

/** Moves a mask to a place in the order it applies in. */
export const reorderMask = defineCommand({
  id: "mask.reorder",
  label: "Reorder mask",
  description:
    "Moves a mask to position index (0 = first, applied first) among the clip's masks. Fails with mask.clip_not_found, mask.not_found and mask.invalid (index out of range).",
  undoable: true,
  input: z.object({ clipId: z.string(), maskId: z.string(), index: z.number().int() }),
  run(ctx, { clipId, maskId, index }) {
    const { store } = ctx.require(projectRef);
    const clip = requirePictureClip(ctx, store.getState(), clipId);
    requireMask(clip, maskId);
    if (index < 0 || index >= clip.maskOrder!.length) {
      throw new CommandFailure("mask.invalid", `index must be 0 to ${clip.maskOrder!.length - 1}.`);
    }
    ctx.mutate(store, (draft) => {
      const order = draft.clips[clipId]!.maskOrder!;
      order.splice(order.indexOf(maskId), 1);
      order.splice(index, 0, maskId);
    });
  },
});

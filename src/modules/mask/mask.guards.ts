import type { CommandContext } from "@/core";
import { CommandFailure } from "@/core";
import { elementRef } from "@/modules/element";
import { MASK_RANGES, type Clip, type ClipMask, type ProjectState } from "@/modules/project";

/** The clip when it is a picture clip on a video track, or `mask.clip_not_found` / `mask.not_picture`. */
export function requirePictureClip(ctx: CommandContext, state: ProjectState, id: string): Clip {
  // Ids come from agents: own keys only, so "constructor" or "__proto__" is never a clip.
  const clip = Object.hasOwn(state.clips, id) ? state.clips[id] : undefined;
  if (!clip) throw new CommandFailure("mask.clip_not_found", `No clip "${id}".`);
  const picture = ctx.require(elementRef).get(clip.kind)?.definition.picture;
  if (!picture || state.tracks[clip.trackId]?.kind !== "video") {
    throw new CommandFailure("mask.not_picture", `Clip "${id}" has no picture to mask.`);
  }
  return clip;
}

/** The mask, or `mask.not_found`. */
export function requireMask(clip: Clip, maskId: string): ClipMask {
  const mask = clip.masks && Object.hasOwn(clip.masks, maskId) ? clip.masks[maskId] : undefined;
  if (!mask)
    throw new CommandFailure("mask.not_found", `Clip "${clip.id}" has no mask "${maskId}".`);
  return mask;
}

/** Fails with `mask.invalid` when `value` is outside the range of the field `name`. */
export function checkRange(name: string, value: number): void {
  const range = MASK_RANGES[name];
  if (range && (value < range.min || value > range.max)) {
    throw new CommandFailure(
      "mask.invalid",
      `${name} must be between ${range.min} and ${range.max}, not ${value}.`,
    );
  }
}

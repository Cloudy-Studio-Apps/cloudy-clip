import { z } from "zod";
import { CommandFailure } from "@/core";
import type { Clip, KeyEase, KeyTrack, Keyframe, KeyValue, ProjectState } from "@/modules/project";
import type { KeyField, KeyframeApi, KeyRef } from "./keyframe.types";

/** A time in microseconds, from 0. */
export const time = z.number().int().min(0).describe("Microseconds");

/** One key, as the commands name it. */
export const keyRef = z.object({
  clipId: z.string(),
  path: z.string().describe('The field, e.g. "transform.x"'),
  keyId: z.string(),
});

const unit = z.number().min(0).max(1);

/** What a key does on the way to the next one. */
export const keyEase = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("linear") }),
  z.object({ kind: z.literal("hold") }),
  z.object({
    kind: z.literal("bezier"),
    x1: unit,
    y1: z.number(),
    x2: unit,
    y2: z.number(),
  }),
  z.object({ kind: z.literal("named"), name: z.enum(["bounce", "elastic"]) }),
]) satisfies z.ZodType<KeyEase>;

/** A value a key can hold. */
export const keyValue = z.union([z.number(), z.string(), z.boolean()]);

/** The key a reference names, with its track and clip; fails with `keyframe.not_found`. */
export function requireKey(
  state: ProjectState,
  ref: KeyRef,
): { clip: Clip; track: KeyTrack; key: Keyframe } {
  const clip = state.clips[ref.clipId];
  const track = clip?.animation?.[ref.path];
  const key = track?.keys.find((k) => k.id === ref.keyId);
  if (!clip || !track || !key) {
    throw new CommandFailure(
      "keyframe.not_found",
      `No key "${ref.keyId}" on "${ref.path}" of clip "${ref.clipId}"`,
      { ...ref },
    );
  }
  return { clip, track, key };
}

/** The clip, or `keyframe.clip_not_found`. */
export function requireClip(state: ProjectState, clipId: string): Clip {
  const clip = state.clips[clipId];
  if (!clip) throw new CommandFailure("keyframe.clip_not_found", `No clip with id "${clipId}"`);
  return clip;
}

/** The keyable field at a path of a clip, or `keyframe.not_keyable`. */
export function requireField(api: KeyframeApi, clip: Clip, path: string) {
  const found = api.fieldOf(clip, path);
  if (!found) {
    throw new CommandFailure("keyframe.not_keyable", `"${path}" can't be keyed on this clip`, {
      clipId: clip.id,
      path,
    });
  }
  return found;
}

/** A value a key can't take: `keyframe.invalid_value`. */
export const invalidValue = (path: string, why: string) =>
  new CommandFailure("keyframe.invalid_value", `"${path}" ${why}`, { path });

/** The value as the field stores it (colors lower case), or `keyframe.invalid_value`. */
export function checkKeyValue(
  field: Pick<KeyField, "path" | "blend" | "min" | "max" | "values">,
  value: KeyValue,
): KeyValue {
  const { path } = field;
  if (field.blend === "number") {
    if (typeof value !== "number" || !Number.isFinite(value))
      throw invalidValue(path, "takes a number");
    const { min = -Infinity, max = Infinity } = field;
    if (value < min || value > max)
      throw invalidValue(path, `takes a number from ${min} to ${max}`);
    return value;
  }
  if (field.blend === "color") {
    if (typeof value !== "string" || !/^#[0-9a-f]{6}$/i.test(value)) {
      throw invalidValue(path, "takes a color like #ff8800");
    }
    return value.toLowerCase();
  }
  if (field.values) {
    if (typeof value !== "string" || !field.values.includes(value)) {
      throw invalidValue(path, `takes one of ${field.values.join(", ")}`);
    }
    return value;
  }
  if (typeof value !== "boolean") throw invalidValue(path, "takes true or false");
  return value;
}

/** Groups keys by clip and path, once each, in the order given. */
export function grouped<T extends { clipId: string; path: string; keyId: string }>(
  keys: readonly T[],
) {
  const seen = new Set<string>();
  const out = new Map<string, Map<string, T[]>>();
  for (const key of keys) {
    const id = `${key.clipId}\n${key.path}\n${key.keyId}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const paths = out.get(key.clipId) ?? new Map<string, T[]>();
    out.set(key.clipId, paths);
    paths.set(key.path, [...(paths.get(key.path) ?? []), key]);
  }
  return out;
}

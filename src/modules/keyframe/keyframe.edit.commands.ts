import { z } from "zod";
import { defineCommand } from "@/core";
import {
  animatedClip,
  clampToClip,
  contentTime,
  formatOf,
  frameDuration,
  moveTrackKeys,
  projectRef,
  timeOfContent,
  withoutKeys,
  writeKey,
  type Clip,
  type KeyEase,
  type KeyTrack,
  type KeyValue,
  type ProjectState,
} from "@/modules/project";
import {
  checkKeyValue,
  grouped,
  invalidValue,
  keyEase,
  keyRef,
  keyValue,
  requireClip,
  requireField,
  requireKey,
  time,
} from "./keyframe.guards";
import { keyframeRef } from "./keyframe.ref";
import type { KeyField } from "./keyframe.types";
import { writeTracks, type TrackEdit } from "./keyframe.write";

/** The field's track with a key at `at` (a timeline time inside the clip), and that key. */
function keyedTrack(
  state: ProjectState,
  clip: Clip,
  field: KeyField,
  at: number,
  value: KeyValue,
  ease?: KeyEase,
) {
  const base: KeyTrack = clip.animation?.[field.path] ?? {
    blend: field.blend,
    ...(field.shared && { shared: true as const }),
    ...(field.min !== undefined && { min: field.min }),
    ...(field.max !== undefined && { max: field.max }),
    keys: [],
  };
  const t = contentTime(clip, at);
  const tolerance = Math.floor(frameDuration(formatOf(state, clip)) / 2);
  const track = writeKey(base, t, value, tolerance, ease);
  const key = track.keys.reduce((a, b) => (Math.abs(b.t - t) < Math.abs(a.t - t) ? b : a));
  return { track, key };
}

/** Adds a key, or updates the one on that frame. */
export const setKey = defineCommand({
  id: "keyframe.set",
  label: "Set keyframe",
  description:
    'Adds a key to a clip\'s field at a timeline time ("at", microseconds; brought into the clip), or updates the one on that frame. "value" defaults to the value the field has there. A field without keys becomes animated. "ease" is how the value moves to the next key: {kind:"linear"}, {kind:"hold"}, {kind:"bezier",x1,y1,x2,y2} (x from 0 to 1) or {kind:"named",name:"bounce"|"elastic"}. Fields are the paths element_describe lists, e.g. "transform.x". Returns { key }, the key\'s id.',
  undoable: true,
  input: z.object({
    clipId: z.string(),
    path: z.string(),
    at: time,
    value: keyValue.optional(),
    ease: keyEase.optional(),
  }),
  async run(ctx, input) {
    const state = ctx.require(projectRef).store.getState();
    const clip = requireClip(state, input.clipId);
    const { field } = requireField(ctx.require(keyframeRef), clip, input.path);
    const at = clampToClip(clip, input.at);
    const value =
      input.value === undefined
        ? field.read(animatedClip(clip, at))
        : checkKeyValue(field, input.value);
    const { track, key } = keyedTrack(state, clip, field, at, value, input.ease);
    await writeTracks(ctx, [{ clipId: clip.id, tracks: { [input.path]: track } }]);
    return { key: key.id };
  },
});

/** Adds keys to several fields of one clip at once. */
export const setKeys = defineCommand({
  id: "keyframe.setMany",
  label: "Set keyframes",
  description:
    'Adds a key to each of a clip\'s fields at a timeline time ("at", microseconds; brought into the clip), or updates the one on that frame, each with the value the field has there. It is one step: if any path can\'t be keyed, nothing changes. Use it to key a row together, like "transform.x" and "transform.y". Returns { keys }, the keys\' ids by path.',
  undoable: true,
  input: z.object({ clipId: z.string(), paths: z.array(z.string()).min(1), at: time }),
  async run(ctx, input) {
    const state = ctx.require(projectRef).store.getState();
    const clip = requireClip(state, input.clipId);
    const api = ctx.require(keyframeRef);
    const at = clampToClip(clip, input.at);
    const tracks: Record<string, KeyTrack> = {};
    const keys: Record<string, string> = {};
    for (const path of new Set(input.paths)) {
      const { field } = requireField(api, clip, path);
      const made = keyedTrack(state, clip, field, at, field.read(animatedClip(clip, at)));
      tracks[path] = made.track;
      keys[path] = made.key.id;
    }
    await writeTracks(ctx, [{ clipId: clip.id, tracks }]);
    return { keys };
  },
});

/** Removes keys. */
export const removeKeys = defineCommand({
  id: "keyframe.remove",
  label: "Remove keyframes",
  description:
    "Removes keys, each named by { clipId, path, keyId }. When a field's last key goes, its value stays as the field's static value. Fails with keyframe.not_found, changing nothing, if any key is gone. Returns { removed }.",
  undoable: true,
  input: z.object({ keys: z.array(keyRef).min(1) }),
  async run(ctx, input) {
    const state = ctx.require(projectRef).store.getState();
    const edits: TrackEdit[] = [];
    for (const [clipId, paths] of grouped(input.keys)) {
      const edit: TrackEdit = { clipId, tracks: {}, statics: {} };
      for (const [path, refs] of paths) {
        const { track } = requireKey(state, refs[0]!);
        for (const ref of refs) requireKey(state, ref);
        const left = withoutKeys(track, new Set(refs.map((r) => r.keyId)));
        edit.tracks[path] = left;
        if (!left) edit.statics![path] = track.keys[track.keys.length - 1]!.value;
      }
      edits.push(edit);
    }
    await writeTracks(ctx, edits);
    return { removed: input.keys.length };
  },
});

/** Moves keys in time, as one gesture. */
export const moveKeys = defineCommand({
  id: "keyframe.move",
  label: "Move keyframes",
  description:
    'Moves keys by "delta" microseconds of timeline time, all together, each with an optional new "value". A moved key replaces an unmoved one it lands on; Fails with keyframe.not_found or keyframe.invalid_value, changing nothing. Returns { moved }.',
  undoable: true,
  input: z.object({
    keys: z.array(keyRef.extend({ value: keyValue.optional() })).min(1),
    delta: z.number().int(),
  }),
  async run(ctx, input) {
    const state = ctx.require(projectRef).store.getState();
    const api = ctx.require(keyframeRef);
    const edits: TrackEdit[] = [];
    for (const [clipId, paths] of grouped(input.keys)) {
      const edit: TrackEdit = { clipId, tracks: {} };
      for (const [path, refs] of paths) {
        const first = requireKey(state, refs[0]!);
        const { clip } = first;
        const tolerance = Math.floor(frameDuration(formatOf(state, clip)) / 2);
        const moves = new Map<string, number>();
        const values = new Map<string, KeyValue>();
        for (const ref of refs) {
          const { key } = requireKey(state, ref);
          const t = contentTime(clip, timeOfContent(clip, key.t) + input.delta);
          moves.set(key.id, t);
          if (ref.value !== undefined) {
            values.set(key.id, checkKeyValue(requireField(api, clip, path).field, ref.value));
          }
        }
        const moved = moveTrackKeys(first.track, moves, tolerance);
        edit.tracks[path] = {
          ...moved,
          keys: moved.keys.map((k) => (values.has(k.id) ? { ...k, value: values.get(k.id)! } : k)),
        };
      }
      edits.push(edit);
    }
    await writeTracks(ctx, edits);
    return { moved: input.keys.length };
  },
});

/** Sets or offsets the values of keys. */
export const setKeyValues = defineCommand({
  id: "keyframe.setValues",
  label: "Change keyframe values",
  description:
    'Changes the values of keys, each { clipId, path, keyId } with a new "value" or an "offset" added to a number (the result stays within the field\'s range). Fails with keyframe.not_found or keyframe.invalid_value, changing nothing. Returns { changed }.',
  undoable: true,
  input: z.object({
    keys: z
      .array(keyRef.extend({ value: keyValue.optional(), offset: z.number().finite().optional() }))
      .min(1),
  }),
  async run(ctx, input) {
    const state = ctx.require(projectRef).store.getState();
    const api = ctx.require(keyframeRef);
    const edits: TrackEdit[] = [];
    for (const [clipId, paths] of grouped(input.keys)) {
      const edit: TrackEdit = { clipId, tracks: {} };
      for (const [path, refs] of paths) {
        const { clip, track } = requireKey(state, refs[0]!);
        const values = new Map<string, KeyValue>();
        for (const ref of refs) {
          const { key } = requireKey(state, ref);
          if (ref.value === undefined && ref.offset === undefined) {
            throw invalidValue(path, "needs a value or an offset");
          }
          let next: KeyValue =
            ref.value === undefined
              ? key.value
              : checkKeyValue(requireField(api, clip, path).field, ref.value);
          if (ref.offset !== undefined) {
            if (typeof next !== "number") throw invalidValue(path, "can't take an offset");
            next = Math.min(
              track.max ?? Infinity,
              Math.max(track.min ?? -Infinity, next + ref.offset),
            );
          }
          values.set(key.id, next);
        }
        edit.tracks[path] = {
          ...track,
          keys: track.keys.map((k) => (values.has(k.id) ? { ...k, value: values.get(k.id)! } : k)),
        };
      }
      edits.push(edit);
    }
    await writeTracks(ctx, edits);
    return { changed: input.keys.length };
  },
});

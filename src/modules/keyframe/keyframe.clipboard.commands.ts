import { z } from "zod";
import { CommandFailure, createId, defineCommand } from "@/core";
import {
  clampToClip,
  contentTime,
  formatOf,
  frameDuration,
  projectRef,
  type Keyframe,
} from "@/modules/project";
import { checkKeyValue, keyRef, requireClip, requireKey, time } from "./keyframe.guards";
import { keyframeRef } from "./keyframe.ref";
import type { CopiedKey } from "./keyframe.types";
import { writeTracks, type TrackEdit } from "./keyframe.write";

/** Copies keys to your own clipboard. Changes nothing in the project. */
export const copyKeys = defineCommand({
  id: "keyframe.copy",
  label: "Copy keyframes",
  description:
    "Copies keys, each { clipId, path, keyId }, with their values and curves, to your own clipboard, which only you can paste from. Fails with keyframe.not_found. Returns { copied }.",
  undoable: false,
  input: z.object({ keys: z.array(keyRef).min(1) }),
  run(ctx, input) {
    const state = ctx.require(projectRef).store.getState();
    const found = input.keys.map((ref) => ({ ref, ...requireKey(state, ref) }));
    const first = Math.min(...found.map(({ key }) => key.t));
    const keys: CopiedKey[] = found.map(({ ref, key }) => ({
      path: ref.path,
      offset: key.t - first,
      value: key.value,
      ...(key.ease && { ease: key.ease }),
      ...(key.smooth && { smooth: key.smooth }),
    }));
    ctx.require(keyframeRef).clipboard.set(ctx.actor, { keys });
    return { copied: keys.length };
  },
});

/** Pastes the copied keys onto clips, on the fields they have in common. */
export const pasteKeys = defineCommand({
  id: "keyframe.paste",
  label: "Paste keyframes",
  description:
    'Pastes what you copied onto clips: the earliest copied key goes at "at" (a timeline time, microseconds; brought into the clip), the others keep their spacing on each clip\'s own time. Only fields the clip has are pasted; a key on the same frame is replaced. Fails with keyframe.clipboard_empty, or keyframe.no_target when no clip takes any key. Returns { pasted }, the number of keys written.',
  undoable: true,
  input: z.object({ at: time, clipIds: z.array(z.string()).min(1) }),
  async run(ctx, input) {
    const copied = ctx.require(keyframeRef).clipboard.get(ctx.actor);
    if (!copied) {
      throw new CommandFailure("keyframe.clipboard_empty", "No keyframes have been copied.");
    }
    const state = ctx.require(projectRef).store.getState();
    const api = ctx.require(keyframeRef);
    const edits: TrackEdit[] = [];
    let pasted = 0;
    for (const clipId of new Set(input.clipIds)) {
      const clip = requireClip(state, clipId);
      const tolerance = Math.floor(frameDuration(formatOf(state, clip)) / 2);
      const base = contentTime(clip, clampToClip(clip, input.at));
      const edit: TrackEdit = { clipId, tracks: {} };
      const paths = new Set(copied.keys.map((k) => k.path));
      for (const path of paths) {
        const found = api.fieldOf(clip, path);
        if (!found) continue;
        const { field } = found;
        const own = copied.keys.filter((k) => k.path === path);
        const added: Keyframe[] = own.map((k) => ({
          id: createId("key"),
          t: base + k.offset,
          value: checkKeyValue(field, k.value),
          ...(k.ease && { ease: k.ease }),
          ...(k.smooth && { smooth: k.smooth }),
        }));
        const existing = clip.animation?.[path] ?? {
          blend: field.blend,
          ...(field.shared && { shared: true as const }),
          ...(field.min !== undefined && { min: field.min }),
          ...(field.max !== undefined && { max: field.max }),
          keys: [],
        };
        const kept = existing.keys.filter(
          (k) => !added.some((a) => Math.abs(a.t - k.t) <= tolerance),
        );
        edit.tracks[path] = { ...existing, keys: [...kept, ...added].sort((a, b) => a.t - b.t) };
        pasted += added.length;
      }
      if (Object.keys(edit.tracks).length > 0) edits.push(edit);
    }
    if (edits.length === 0) {
      throw new CommandFailure(
        "keyframe.no_target",
        "None of those clips has a field that was copied.",
      );
    }
    await writeTracks(ctx, edits);
    return { pasted };
  },
});

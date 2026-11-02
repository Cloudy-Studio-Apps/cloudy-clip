import { z } from "zod";
import { CommandFailure, defineCommand } from "@/core";
import {
  EASE_PRESETS,
  contentTime,
  formatOf,
  frameDuration,
  mirrorEase,
  moveTrackKeys,
  projectRef,
  timeOfContent,
  type EasePresetId,
  type KeyEase,
  type KeyTrack,
} from "@/modules/project";
import { grouped, invalidValue, keyEase, keyRef, requireClip, requireKey } from "./keyframe.guards";
import { keyframeRef } from "./keyframe.ref";
import { writeTracks, type TrackEdit } from "./keyframe.write";

const presetIds = EASE_PRESETS.map((p) => p.id) as [EasePresetId, ...EasePresetId[]];

/** Sets how keys ease to the next key, or whether their handles stay in line. */
export const setEase = defineCommand({
  id: "keyframe.setEase",
  label: "Change keyframe curve",
  description:
    'Sets the curve of keys, each change { key: { clipId, path, keyId }, ease?, smooth? }. "ease" is how the value moves from that key to the next: a preset name (see keyframe_list_eases) or {kind:"linear"|"hold"} / {kind:"bezier",x1,y1,x2,y2} (x from 0 to 1) / {kind:"named",name:"bounce"|"elastic"}. "smooth" keeps the handles on both sides of the key in line. Needs ease or smooth. Fails with keyframe.not_found, changing nothing. Returns { changed }.',
  undoable: true,
  input: z.object({
    changes: z
      .array(
        z.object({
          key: keyRef,
          ease: z.union([keyEase, z.enum(presetIds)]).optional(),
          smooth: z.boolean().optional(),
        }),
      )
      .min(1),
  }),
  async run(ctx, input) {
    const state = ctx.require(projectRef).store.getState();
    const edits: TrackEdit[] = [];
    for (const [clipId, paths] of grouped(input.changes.map((c) => ({ ...c, ...c.key })))) {
      const edit: TrackEdit = { clipId, tracks: {} };
      for (const [path, changes] of paths) {
        const { track } = requireKey(state, changes[0]!.key);
        const next = new Map<string, (typeof changes)[number]>();
        for (const change of changes) {
          requireKey(state, change.key);
          if (change.ease === undefined && change.smooth === undefined) {
            throw invalidValue(path, "needs an ease or smooth");
          }
          next.set(change.key.keyId, change);
        }
        edit.tracks[path] = {
          ...track,
          keys: track.keys.map((key) => {
            const change = next.get(key.id);
            if (!change) return key;
            const smooth = change.smooth === undefined ? key.smooth : change.smooth || undefined;
            const ease: KeyEase | undefined =
              typeof change.ease === "string"
                ? EASE_PRESETS.find((p) => p.id === change.ease)!.ease
                : (change.ease ?? key.ease);
            return {
              id: key.id,
              t: key.t,
              value: key.value,
              ...(ease && { ease }),
              ...(smooth && { smooth: true as const }),
            };
          }),
        };
      }
      edits.push(edit);
    }
    await writeTracks(ctx, edits);
    return { changed: input.changes.length };
  },
});

/** Sets what a field does after its last key. */
export const setAfter = defineCommand({
  id: "keyframe.setAfter",
  label: "Set what happens after the last keyframe",
  description:
    'Sets what a field does after its last key: "hold" (keeps the last value), "loop" (starts over) or "pingpong" (plays back and forth). Fails with keyframe.not_found when the field has no keys, or keyframe.no_loop on a field that can\'t loop (speed). Returns { after }.',
  undoable: true,
  input: z.object({
    clipId: z.string(),
    path: z.string(),
    after: z.enum(["hold", "loop", "pingpong"]),
  }),
  async run(ctx, input) {
    const state = ctx.require(projectRef).store.getState();
    const clip = requireClip(state, input.clipId);
    const track = clip.animation?.[input.path];
    if (!track) {
      throw new CommandFailure("keyframe.not_found", `"${input.path}" has no keys`, {
        clipId: input.clipId,
        path: input.path,
      });
    }
    const found = ctx.require(keyframeRef).fieldOf(clip, input.path);
    if (input.after !== "hold" && found?.field.loops === false) {
      throw new CommandFailure("keyframe.no_loop", `"${input.path}" can't loop`, {
        path: input.path,
      });
    }
    const next: KeyTrack = { ...track, after: input.after === "hold" ? undefined : input.after };
    if (next.after === undefined) delete next.after;
    await writeTracks(ctx, [{ clipId: clip.id, tracks: { [input.path]: next } }]);
    return { after: input.after };
  },
});

/** Stretches or flips keys around a time. */
export const scaleKeys = defineCommand({
  id: "keyframe.scale",
  label: "Stretch keyframes",
  description:
    'Scales the distance of keys from "pivot" (a timeline time, microseconds) by "factor" (not 0): 2 doubles the gaps, 0.5 halves them, -1 flips them around the pivot, reversing their curves. Times round to whole microseconds. Fails with keyframe.not_found, or keyframe.invalid_value when keys would land on the same time, changing nothing. Returns { scaled }.',
  undoable: true,
  input: z.object({
    keys: z.array(keyRef).min(1),
    pivot: z.number().int(),
    factor: z
      .number()
      .finite()
      .refine((n) => n !== 0, "factor can't be 0"),
  }),
  async run(ctx, input) {
    const state = ctx.require(projectRef).store.getState();
    const edits: TrackEdit[] = [];
    for (const [clipId, paths] of grouped(input.keys)) {
      const edit: TrackEdit = { clipId, tracks: {} };
      for (const [path, refs] of paths) {
        const { clip, track } = requireKey(state, refs[0]!);
        for (const ref of refs) requireKey(state, ref);
        const tolerance = Math.floor(frameDuration(formatOf(state, clip)) / 2);
        const ids = new Set(refs.map((r) => r.keyId));
        const picked = track.keys.filter((k) => ids.has(k.id));
        const moves = new Map<string, number>();
        for (const key of picked) {
          const at =
            input.pivot + Math.round((timeOfContent(clip, key.t) - input.pivot) * input.factor);
          moves.set(key.id, contentTime(clip, at));
        }
        if (new Set(moves.values()).size < moves.size) {
          throw invalidValue(path, "can't be scaled that far: keys would land on the same time");
        }
        const moved = moveTrackKeys(track, moves, tolerance);
        if (input.factor < 0) {
          const order = moved.keys.filter((k) => ids.has(k.id));
          // Picked keys side by side in the track: their segments flip with them. Otherwise a
          // segment may reach a key that wasn't picked, so each key keeps its own ease, mirrored.
          const at = picked.map((k) => track.keys.findIndex((x) => x.id === k.id));
          const together = at.every((n, i) => i === 0 || n === at[i - 1]! + 1);
          const eases = new Map<string, KeyEase | undefined>(
            order.map((k, i) => {
              if (!together) {
                return [k.id, mirrorEase(picked.find((p) => p.id === k.id)?.ease)];
              }
              const old = picked[picked.length - 2 - i];
              return [k.id, i === order.length - 1 ? undefined : mirrorEase(old?.ease)];
            }),
          );
          moved.keys = moved.keys.map((k) => {
            if (!eases.has(k.id)) return k;
            const ease = eases.get(k.id);
            return {
              id: k.id,
              t: k.t,
              value: k.value,
              ...(ease && { ease }),
              ...(k.smooth && { smooth: k.smooth }),
            };
          });
        }
        edit.tracks[path] = moved;
      }
      edits.push(edit);
    }
    await writeTracks(ctx, edits);
    return { scaled: input.keys.length };
  },
});

import { z } from "zod";
import { CommandFailure, defineCommand, type CommandContext } from "@/core";
import {
  clampToClip,
  contentTime,
  formatOf,
  frameDuration,
  projectRef,
  withoutTracks,
  writeKey,
  type Clip,
  type KeyTrack,
  type KeyValue,
  type ProjectState,
} from "@/modules/project";
import { elementRef } from "./element.ref";
import { checkGroupsApply, checkResetPaths, parsePatch } from "./element.guards";
import type { GroupWrites } from "./element.types";
import { applyGroupPatch, applyPropsPatch, finishProps, resetPaths } from "./logic/apply";
import { splitAnimated } from "./logic/animated";
import { deepEqual } from "./logic/values";

const clipIds = z.array(z.string()).min(1);

/** The clips and their one element, or the failure that stops the command. */
function target(ctx: CommandContext, state: ProjectState, ids: readonly string[]) {
  const clips: Clip[] = ids.map((id) => {
    const clip = state.clips[id];
    if (!clip) throw new CommandFailure("element.clip_not_found", `No clip with id "${id}"`);
    return clip;
  });
  const kinds = new Set(clips.map((c) => c.kind ?? "media"));
  if (kinds.size > 1) {
    throw new CommandFailure(
      "element.mixed_kinds",
      `These clips are different kinds (${[...kinds].join(", ")}); change one kind at a time.`,
    );
  }
  const kind = [...kinds][0]!;
  const element = ctx.require(elementRef).get(kind);
  if (!element) {
    throw new CommandFailure("element.unknown_kind", `No module provides "${kind}" clips.`);
  }
  return { clips, element };
}

/** A clip's new props and group values. */
interface ClipWrite {
  id: string;
  props: Record<string, unknown>;
  groups: GroupWrites;
  /** The clip's key tracks after the write; present means set (undefined removes them all). */
  animation?: Record<string, KeyTrack> | undefined;
}

/**
 * Writes the clips whose values really change, in one `ctx.mutate`. Nothing changes: no mutate,
 * so no undo step.
 */
function write(ctx: CommandContext, state: ProjectState, writes: readonly ClipWrite[]) {
  const changed = writes.filter((write) => {
    const clip = state.clips[write.id]!;
    return (
      !deepEqual(write.props, clip.props ?? {}) ||
      write.groups.some(([key, value]) => !deepEqual(value, clip[key])) ||
      ("animation" in write && !deepEqual(write.animation, clip.animation))
    );
  });
  if (changed.length === 0) return;
  const store = ctx.require(projectRef).store;
  ctx.mutate(store, (draft) => {
    for (const write of changed) {
      const { id, props, groups } = write;
      const clip = draft.clips[id]!;
      clip.props = props;
      if ("animation" in write) {
        if (write.animation) clip.animation = write.animation;
        else delete clip.animation;
      }
      for (const [key, value] of groups) {
        if (value === undefined) delete clip[key];
        else clip[key] = value;
      }
    }
  });
}

/**
 * Changes the values of clips of one kind (text, a plugin's element): only the given fields, groups
 * one level deep. Supported shared groups go under their key (`transform: { x }`). A field the clip
 * animates gets a key at `at` (a timeline time, brought into the clip) instead of a static value.
 */
export const setProps = defineCommand({
  id: "element.setProps",
  label: "Change properties",
  description:
    'Changes properties of one or more clips of the same kind. "patch" holds only the fields to change; groups (outline, shadow, …) may be partial, e.g. { "size": 120, "outline": { "enabled": true } }. Shared groups go under their key, e.g. { "transform": { "x": 40 } } (output pixels from the frame center). A field the clip animates needs "at" (timeline time, microseconds): a key is written there, on the nearest frame when "at" is outside it; to make a field animated or edit keys use keyframe_set. List every kind\'s properties, ranges, units and defaults with element_describe. Values are checked against those ranges; nothing changes if one is wrong. Returns the clips.',
  undoable: true,
  input: z.object({
    clipIds,
    patch: z.record(z.string(), z.unknown()),
    at: z.number().int().min(0).optional(),
  }),
  run(ctx, input) {
    const store = ctx.require(projectRef).store;
    const state = store.getState();
    const { clips, element } = target(ctx, state, input.clipIds);
    const patch = parsePatch(element, input.patch);
    checkGroupsApply(
      element,
      clips.map((clip) => ({ clip, track: state.tracks[clip.trackId] })),
      patch,
    );
    const split = clips.map((clip) => ({ clip, ...splitAnimated(clip, patch, element) }));
    const unkeyed = split.find(({ keyed }) => keyed.size > 0);
    if (unkeyed && input.at === undefined) {
      const path = [...unkeyed.keyed.keys()][0]!;
      throw new CommandFailure(
        "element.animated",
        `"${path}" is animated: pass "at" (a timeline time) to key it, or use keyframe_set`,
      );
    }
    const next = split.map(({ clip, keyed, rest }): ClipWrite => {
      const format = formatOf(state, clip);
      const write: ClipWrite = {
        id: clip.id,
        props: applyPropsPatch(ctx, element, clip, rest, format),
        groups: applyGroupPatch(element, clip, rest, format),
      };
      if (keyed.size > 0) {
        const t = contentTime(clip, clampToClip(clip, input.at!));
        const tolerance = Math.floor(frameDuration(format) / 2);
        const animation = { ...clip.animation };
        for (const [path, value] of keyed) {
          animation[path] = writeKey(animation[path]!, t, value as KeyValue, tolerance);
        }
        write.animation = animation;
      }
      return write;
    });
    write(ctx, state, next);
    const after = store.getState();
    return input.clipIds.map((id) => after.clips[id]);
  },
});

/** Puts properties of clips back to their defaults: the given paths, or all of them. */
export const resetProps = defineCommand({
  id: "element.resetProps",
  label: "Reset properties",
  description:
    'Puts properties of one or more clips of the same kind back to their defaults. "paths" lists fields ("size", "outline.width", "outline") or shared groups ("transform"); without it every property is reset (shared groups are kept). Returns the clips.',
  undoable: true,
  input: z.object({ clipIds, paths: z.array(z.string()).optional() }),
  run(ctx, input) {
    const store = ctx.require(projectRef).store;
    const state = store.getState();
    const { clips, element } = target(ctx, state, input.clipIds);
    if (input.paths) checkResetPaths(element, input.paths);
    const next = clips.map((clip): ClipWrite => {
      const format = formatOf(state, clip);
      const reset = resetPaths(element, clip, input.paths, format);
      const { paths } = input;
      const animation = withoutTracks(clip.animation, (path, track) =>
        paths ? paths.some((p) => path === p || path.startsWith(`${p}.`)) : track.shared !== true,
      );
      return {
        id: clip.id,
        ...reset,
        props: finishProps(ctx, element, reset.props, {}, format),
        ...(clip.animation ? { animation } : {}),
      };
    });
    write(ctx, state, next);
    const after = store.getState();
    return input.clipIds.map((id) => after.clips[id]);
  },
});

/** The generic commands on any element's values. */
export const elementCommands = [setProps, resetProps];

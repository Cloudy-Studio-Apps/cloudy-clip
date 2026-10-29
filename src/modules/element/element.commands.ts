import { z } from "zod";
import { CommandFailure, defineCommand, type CommandContext } from "@/core";
import { projectRef, type Clip, type ProjectState } from "@/modules/project";
import { elementRef } from "./element.ref";
import { checkGroupsApply, checkResetPaths, parsePatch } from "./element.guards";
import type { GroupWrites } from "./element.types";
import { applyGroupPatch, applyPropsPatch, finishProps, resetPaths } from "./logic/apply";
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
}

/**
 * Writes the clips whose values really change, in one `ctx.mutate`. Nothing changes: no mutate,
 * so no undo step.
 */
function write(ctx: CommandContext, state: ProjectState, writes: readonly ClipWrite[]) {
  const changed = writes.filter(({ id, props, groups }) => {
    const clip = state.clips[id]!;
    return (
      !deepEqual(props, clip.props ?? {}) ||
      groups.some(([key, value]) => !deepEqual(value, clip[key]))
    );
  });
  if (changed.length === 0) return;
  const store = ctx.require(projectRef).store;
  ctx.mutate(store, (draft) => {
    for (const { id, props, groups } of changed) {
      const clip = draft.clips[id]!;
      clip.props = props;
      for (const [key, value] of groups) {
        if (value === undefined) delete clip[key];
        else clip[key] = value;
      }
    }
  });
}

/**
 * Changes the values of clips of one kind (text, a plugin's element): only the given fields, groups
 * one level deep. Supported shared groups go under their key (`transform: { x }`).
 */
export const setProps = defineCommand({
  id: "element.setProps",
  label: "Change properties",
  description:
    'Changes properties of one or more clips of the same kind. "patch" holds only the fields to change; groups (outline, shadow, …) may be partial, e.g. { "size": 120, "outline": { "enabled": true } }. Shared groups go under their key, e.g. { "transform": { "x": 40 } } (output pixels from the frame center). List every kind\'s properties, ranges, units and defaults with element_describe. Values are checked against those ranges; nothing changes if one is wrong. Returns the clips.',
  undoable: true,
  input: z.object({ clipIds, patch: z.record(z.string(), z.unknown()) }),
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
    const next = clips.map((clip) => ({
      id: clip.id,
      props: applyPropsPatch(ctx, element, clip, patch, state.format),
      groups: applyGroupPatch(element, clip, patch, state.format),
    }));
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
    const next = clips.map((clip) => {
      const reset = resetPaths(element, clip, input.paths, state.format);
      return {
        id: clip.id,
        ...reset,
        props: finishProps(ctx, element, reset.props, {}, state.format),
      };
    });
    write(ctx, state, next);
    const after = store.getState();
    return input.clipIds.map((id) => after.clips[id]);
  },
});

/** The generic commands on any element's values. */
export const elementCommands = [setProps, resetProps];

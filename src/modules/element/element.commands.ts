import { z } from "zod";
import { CommandFailure, defineCommand, type CommandContext } from "@/core";
import { projectRef, type Clip, type ProjectState } from "@/modules/project";
import { elementRef } from "./element.ref";
import type { ResolvedElement } from "./element.types";
import { applyGroupPatch, applyPropsPatch, resetPaths } from "./logic/apply";
import { leafPaths } from "./logic/paths";

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

/** The patch parsed by the element's schema, refusing read-only fields. */
function parsePatch(element: ResolvedElement, patch: Record<string, unknown>) {
  const parsed = element.schema.safeParse(patch);
  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    const where = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
    throw new CommandFailure(
      "element.invalid_props",
      `${element.definition.name}: ${where}${issue.message}`,
    );
  }
  const values = parsed.data as Record<string, unknown>;
  for (const path of leafPaths(values)) {
    if (element.fields.get(path)?.readOnly) {
      throw new CommandFailure("element.read_only", `"${path}" can't be changed`);
    }
  }
  return values;
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
    const next = clips.map((clip) => ({
      id: clip.id,
      props: applyPropsPatch(ctx, element, clip, patch, state.format),
      groups: applyGroupPatch(element, clip, patch, state.format),
    }));
    ctx.mutate(store, (draft) => {
      for (const { id, props, groups } of next) {
        const clip = draft.clips[id]!;
        clip.props = props;
        for (const [key, value] of groups) {
          if (value === undefined) delete clip[key];
          else clip[key] = value;
        }
      }
    });
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
    const next = clips.map((clip) => ({
      id: clip.id,
      ...resetPaths(element, clip, input.paths, state.format),
    }));
    ctx.mutate(store, (draft) => {
      for (const { id, props, groups } of next) {
        const clip = draft.clips[id]!;
        clip.props = props;
        for (const [key, value] of groups) {
          if (value === undefined) delete clip[key];
          else clip[key] = value;
        }
      }
    });
    const after = store.getState();
    return input.clipIds.map((id) => after.clips[id]);
  },
});

/** The generic commands on any element's values. */
export const elementCommands = [setProps, resetProps];

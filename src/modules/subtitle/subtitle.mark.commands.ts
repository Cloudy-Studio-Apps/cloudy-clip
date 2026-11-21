import { z } from "zod";
import { CommandFailure, defineCommand } from "@/core";
import { projectRef, stylesOf, type SubtitleStyle } from "@/modules/project";
import { styleLeaves } from "./logic/overrides";
import { compositionOfClip, requireCue, requireStyle, requireTextClip } from "./subtitle.guards";
import { missingDefault, restyle, storeStyles } from "./subtitle.write";

const clipIds = z.array(z.string()).min(1);

/** Marks text clips as subtitle cues of a style, writing the style over their look. */
export const mark = defineCommand({
  id: "subtitle.mark",
  label: "Mark as subtitle",
  description:
    'Marks text clips as subtitle cues of a style ("styleId", else each clip\'s composition default; a composition without styles first gets "Default"). The style\'s values are written over the clip\'s look (text props and transform x/y); its words, other transform values, keys, masks and timing stay, and keyed fields keep their keys. Marking a cue again with another style writes the new style only where the cue followed its old one. One undo step. Fails with subtitle.clip_not_found, subtitle.not_text, subtitle.style_not_found (also a style of another composition) and subtitle.composition_not_found. Returns { marked }.',
  undoable: true,
  input: z.object({ clipIds, styleId: z.string().optional() }),
  async run(ctx, input) {
    const { store } = ctx.require(projectRef);
    const state = store.getState();
    const given = input.styleId === undefined ? undefined : requireStyle(state, input.styleId);
    const made = new Map<string, SubtitleStyle>();
    const targets = input.clipIds.map((id) => {
      const clip = requireTextClip(state, id);
      const composition = compositionOfClip(state, clip);
      if (given && given.compositionId !== composition.id) {
        throw new CommandFailure(
          "subtitle.style_not_found",
          `Style "${given.id}" is not a style of clip "${id}"'s composition.`,
        );
      }
      let style = given ?? stylesOf(state, composition.id)[0] ?? made.get(composition.id);
      if (!style) {
        style = missingDefault(ctx, composition)!;
        made.set(composition.id, style);
      }
      const from = clip.subtitle ? (state.subtitleStyles?.[clip.subtitle.styleId] ?? null) : null;
      return { id, from, to: style };
    });
    storeStyles(ctx, [...made.values()]);
    for (const { id, from, to } of targets) await restyle(ctx, id, from, to);
    ctx.mutate(store, (draft) => {
      for (const { id, to } of targets) draft.clips[id]!.subtitle = { styleId: to.id };
    });
    return { marked: input.clipIds };
  },
});

/** Drops subtitle marks; the clips keep their look. */
export const unmark = defineCommand({
  id: "subtitle.unmark",
  label: "Unmark subtitle",
  description:
    "Turns subtitle cues back into plain text clips. Their look is already stored in them, so nothing else changes. Fails with subtitle.clip_not_found, subtitle.not_text and subtitle.not_marked.",
  undoable: true,
  input: z.object({ clipIds }),
  run(ctx, { clipIds: ids }) {
    const { store } = ctx.require(projectRef);
    for (const id of ids) requireCue(store.getState(), id);
    ctx.mutate(store, (draft) => {
      for (const id of ids) delete draft.clips[id]!.subtitle;
    });
  },
});

/** Writes a cue's style back into it: all its values, or the given paths. */
export const resetToStyle = defineCommand({
  id: "subtitle.resetToStyle",
  label: "Reset to style",
  description:
    'Writes the style\'s values into cues: every value, or only "paths" (style paths such as "size", "fill.color", "transform.x"). Keyed fields keep their keys. One undo step. Fails with subtitle.clip_not_found, subtitle.not_text, subtitle.not_marked and subtitle.invalid_style (a path the style has no value at).',
  undoable: true,
  input: z.object({ clipIds, paths: z.array(z.string()).min(1).optional() }),
  async run(ctx, { clipIds: ids, paths }) {
    const state = ctx.require(projectRef).store.getState();
    const cues = ids.map((id) => {
      const { style } = requireCue(state, id);
      const leaves = [...styleLeaves(style).keys()];
      const missing = paths?.find((path) => !leaves.includes(path));
      if (missing !== undefined) {
        throw new CommandFailure("subtitle.invalid_style", `A style has no value at "${missing}".`);
      }
      return { id, style, skip: paths ? leaves.filter((path) => !paths.includes(path)) : [] };
    });
    for (const { id, style, skip } of cues) await restyle(ctx, id, null, style, skip);
  },
});

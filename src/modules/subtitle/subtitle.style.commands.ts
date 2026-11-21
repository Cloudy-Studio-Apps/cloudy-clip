import { z } from "zod";
import { CommandFailure, defineCommand } from "@/core";
import { elementRef, mergeProps } from "@/modules/element";
import { formatOf, projectRef, stylesOf, type Composition } from "@/modules/project";
import { defaultTextStyle, textStyleOf } from "@/modules/text";
import { PRESET_NAMES, subtitlePreset } from "./logic/presets";
import {
  compositionOfClip,
  requireComposition,
  requireStyle,
  requireTextClip,
} from "./subtitle.guards";
import { styleName, subtitlePresetId } from "./subtitle.schema";
import {
  makeStyle,
  missingDefault,
  normalizeStyleProps,
  restyle,
  storeStyles,
} from "./subtitle.write";

const finite = z.number().finite();
const PX =
  "Sizes and positions are the composition's output pixels; position is from the frame's center.";

/** Cue ids of a style, in the project's clip order. */
function cuesOf(clips: Record<string, { subtitle?: { styleId: string } }>, styleId: string) {
  return Object.entries(clips)
    .filter(([, clip]) => clip.subtitle?.styleId === styleId)
    .map(([id]) => id);
}

/** Adds a subtitle style to a composition: from a preset, another style or a cue's look. */
export const addStyle = defineCommand({
  id: "subtitle.addStyle",
  label: "Add subtitle style",
  description: `Adds a subtitle style. Give at most one source: "preset" (classic, punchy, intense, whisper; the default is classic), "fromStyleId" (a copy of that style) or "fromClipId" (the look of a text clip: its text props and transform x/y). The composition is "compositionId", else the source's, else the one you have open. A composition without styles first gets "Default" (Classic), in the same undo step (asking for Classic with no name there just makes Default). "name" (1-60) defaults to the preset's name, "<style> copy" or "Style N". ${PX} Fails with subtitle.invalid_style (two sources), subtitle.composition_not_found, subtitle.style_not_found, subtitle.clip_not_found and subtitle.not_text. Returns { styleId }.`,
  undoable: true,
  input: z.object({
    compositionId: z.string().optional(),
    name: styleName.optional(),
    preset: subtitlePresetId.optional(),
    fromStyleId: z.string().optional(),
    fromClipId: z.string().optional(),
  }),
  run(ctx, input) {
    const state = ctx.require(projectRef).store.getState();
    const sources = [input.preset, input.fromStyleId, input.fromClipId].filter(
      (s) => s !== undefined,
    );
    if (sources.length > 1) {
      throw new CommandFailure(
        "subtitle.invalid_style",
        'Give one of "preset", "fromStyleId" or "fromClipId".',
      );
    }
    const fromStyle =
      input.fromStyleId === undefined ? undefined : requireStyle(state, input.fromStyleId);
    const fromClip =
      input.fromClipId === undefined ? undefined : requireTextClip(state, input.fromClipId);
    const composition: Composition = requireComposition(
      ctx,
      input.compositionId ??
        fromStyle?.compositionId ??
        (fromClip && compositionOfClip(state, fromClip).id),
    );
    const first = missingDefault(ctx, composition);
    if (
      first &&
      !fromStyle &&
      !fromClip &&
      (input.preset ?? "classic") === "classic" &&
      !input.name
    ) {
      // Default is already that style: one, not two.
      storeStyles(ctx, [first]);
      return { styleId: first.id };
    }
    const count = stylesOf(state, composition.id).length + (first ? 1 : 0);
    let look;
    let name;
    if (fromStyle) {
      look = fromStyle;
      name = `${fromStyle.name} copy`.slice(0, 60);
    } else if (fromClip) {
      const format = formatOf(state, fromClip);
      const transform = ctx.require(elementRef).resolve(fromClip, format).transform as {
        x: number;
        y: number;
      };
      const props = textStyleOf(fromClip, format) as unknown as Record<string, unknown>;
      look = { props, position: { x: transform.x, y: transform.y } };
      name = `Style ${count + 1}`;
    } else {
      const preset = input.preset ?? "classic";
      look = subtitlePreset(preset, composition.format);
      name = PRESET_NAMES[preset];
    }
    const style = makeStyle(ctx, composition, input.name ?? name, look, first ? 1 : 0);
    storeStyles(ctx, first ? [first, style] : [style]);
    return { styleId: style.id };
  },
});

/** Changes a style and writes it into every cue that followed it. */
export const updateStyle = defineCommand({
  id: "subtitle.updateStyle",
  label: "Edit subtitle style",
  description: `Changes a subtitle style: "props" is a patch of text values (font, size, weight, italic, letterSpacing, lineHeight, align, uppercase, fill, outline, background, shadow; groups may be partial, as in element_set_props), "position" its x and/or y. The new values are written into every cue of the style whose value equaled the style's old one, in the same undo step; a cue's own values and keyed fields stay. Weights and italic snap to faces the font has, as on a cue. ${PX} Fails with subtitle.style_not_found and subtitle.invalid_style. Returns { restyled }: the cues that changed.`,
  undoable: true,
  input: z.object({
    styleId: z.string(),
    props: z.record(z.string(), z.unknown()).optional(),
    position: z.object({ x: finite, y: finite }).partial().strict().optional(),
  }),
  async run(ctx, input) {
    const { store } = ctx.require(projectRef);
    const state = store.getState();
    const style = requireStyle(state, input.styleId);
    const composition = state.compositions[style.compositionId]!;
    const allowed = Object.keys(defaultTextStyle(composition.format));
    const extra = Object.keys(input.props ?? {}).find((key) => !allowed.includes(key));
    if (extra !== undefined) {
      throw new CommandFailure("subtitle.invalid_style", `"${extra}" is not a style value.`);
    }
    const next = {
      ...style,
      props: normalizeStyleProps(ctx, mergeProps(style.props, input.props ?? {}), composition),
      position: { ...style.position, ...input.position },
    };
    const restyled: string[] = [];
    for (const id of cuesOf(state.clips, style.id)) {
      if (await restyle(ctx, id, style, next)) restyled.push(id);
    }
    ctx.mutate(store, (draft) => {
      draft.subtitleStyles![style.id] = next;
    });
    return { restyled };
  },
});

/** Renames a style. */
export const renameStyle = defineCommand({
  id: "subtitle.renameStyle",
  label: "Rename subtitle style",
  description:
    'Renames a subtitle style ("name", 1-60 characters). Fails with subtitle.style_not_found.',
  undoable: true,
  input: z.object({ styleId: z.string(), name: styleName }),
  run(ctx, { styleId, name }) {
    const { store } = ctx.require(projectRef);
    requireStyle(store.getState(), styleId);
    ctx.mutate(store, (draft) => {
      draft.subtitleStyles![styleId]!.name = name;
    });
  },
});

/** Deletes a style; its cues move to the composition's default style. */
export const removeStyle = defineCommand({
  id: "subtitle.removeStyle",
  label: "Delete subtitle style",
  description:
    "Deletes a subtitle style. Its cues move to the composition's default style (the first; the second when deleting the first): the default's values are written where a cue followed the deleted style, its own values stay. One undo step. Fails with subtitle.style_not_found and subtitle.last_style (a composition keeps at least one style). Returns { moved }: the cues.",
  undoable: true,
  input: z.object({ styleId: z.string() }),
  async run(ctx, { styleId }) {
    const { store } = ctx.require(projectRef);
    const state = store.getState();
    const style = requireStyle(state, styleId);
    const target = stylesOf(state, style.compositionId).find((s) => s.id !== styleId);
    if (!target) {
      throw new CommandFailure(
        "subtitle.last_style",
        "A composition keeps at least one subtitle style.",
      );
    }
    const moved = cuesOf(state.clips, styleId);
    for (const id of moved) await restyle(ctx, id, style, target);
    ctx.mutate(store, (draft) => {
      for (const id of moved) draft.clips[id]!.subtitle = { styleId: target.id };
      delete draft.subtitleStyles![styleId];
      const composition = draft.compositions[style.compositionId]!;
      composition.subtitleStyleOrder = composition.subtitleStyleOrder!.filter(
        (id) => id !== styleId,
      );
    });
    return { moved };
  },
});

/** Puts a composition's styles in a new order; the first is the default. */
export const reorderStyles = defineCommand({
  id: "subtitle.reorderStyles",
  label: "Reorder subtitle styles",
  description:
    'Sets the order of a composition\'s subtitle styles ("styleIds": each of its styles once; the first is the default). The composition is "compositionId", else the one you have open. Fails with subtitle.composition_not_found and subtitle.invalid_style.',
  undoable: true,
  input: z.object({ compositionId: z.string().optional(), styleIds: z.array(z.string()) }),
  run(ctx, input) {
    const { store } = ctx.require(projectRef);
    const composition = requireComposition(ctx, input.compositionId);
    const ids = stylesOf(store.getState(), composition.id).map((s) => s.id);
    const given = new Set(input.styleIds);
    if (
      given.size !== input.styleIds.length ||
      given.size !== ids.length ||
      ids.some((id) => !given.has(id))
    ) {
      throw new CommandFailure(
        "subtitle.invalid_style",
        `"styleIds" must list each of the composition's styles once: ${ids.join(", ")}.`,
      );
    }
    ctx.mutate(store, (draft) => {
      draft.compositions[composition.id]!.subtitleStyleOrder = [...input.styleIds];
    });
  },
});

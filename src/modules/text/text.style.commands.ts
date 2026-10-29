import { z } from "zod";
import { CommandFailure, defineCommand, type CommandContext } from "@/core";
import { fontsRef } from "@/modules/fonts";
import {
  isTextClip,
  mergeTextStyle,
  projectRef,
  textStyleOf,
  type TextClip,
} from "@/modules/project";
import { setClipTransform } from "@/modules/transform";
import { presetStyle, presetTransform } from "./logic/presets";
import { textPresetId, textStylePatch } from "./text.schema";

/** The text clip with this id, or the failure that tells why it is not one. */
function textClipOf(ctx: CommandContext, clipId: string): TextClip {
  const clip = ctx.require(projectRef).store.getState().clips[clipId];
  if (!clip) throw new CommandFailure("text.clip_not_found", `No clip with id "${clipId}"`);
  if (!isTextClip(clip)) {
    throw new CommandFailure("text.not_text", `Clip "${clipId}" is not a text clip`);
  }
  return clip;
}

/** Changes the words of a text clip. */
export const setText = defineCommand({
  id: "text.setText",
  label: "Edit text",
  description:
    "Changes the words of a text clip (line breaks with \\n). Fails if the clip is not a text clip or the words are empty. Returns the clip.",
  undoable: true,
  input: z.object({ clipId: z.string(), text: z.string() }),
  run(ctx, { clipId, text }) {
    textClipOf(ctx, clipId);
    if (text.trim() === "") throw new CommandFailure("text.empty", "The text can't be empty");
    const store = ctx.require(projectRef).store;
    ctx.mutate(store, (draft) => {
      (draft.clips[clipId] as TextClip).text = text;
    });
    return store.getState().clips[clipId];
  },
});

/** Writes the merged style (and nothing else) of a clip; the clip is validated by the caller. */
function writeStyle(
  ctx: CommandContext,
  clipIds: string[],
  patch: Parameters<typeof mergeTextStyle>[1],
) {
  const store = ctx.require(projectRef).store;
  const format = store.getState().format;
  ctx.mutate(store, (draft) => {
    for (const id of clipIds) {
      const clip = draft.clips[id] as TextClip;
      clip.style = mergeTextStyle(textStyleOf(clip, format), patch);
    }
  });
}

/** Changes the look of one or more text clips; only the given fields change. */
export const setTextStyle = defineCommand({
  id: "text.setStyle",
  label: "Style text",
  description:
    "Changes how text clips look; fields left out keep their value, nested groups (fill, outline, background, shadow) merge field by field. Sizes, padding, outline width, blur and distance are output pixels; colors are #rrggbb; opacities 0-1; shadow angle in degrees (90 = down). font is { family, source } with source bundled, installed or google: list the choices with fonts_list. A weight that the font family doesn't have fails. All clips are checked first, so a bad one changes nothing. Returns the clips.",
  undoable: true,
  input: z.object({ clipIds: z.array(z.string()).min(1), style: textStylePatch }),
  async run(ctx, { clipIds, style }) {
    const store = ctx.require(projectRef).store;
    const format = store.getState().format;
    const clips = clipIds.map((id) => textClipOf(ctx, id));
    const families = await ctx.require(fontsRef).families();
    for (const clip of clips) {
      const next = mergeTextStyle(textStyleOf(clip, format), style);
      const family = families.find((f) => f.family === next.font.family);
      if (family && !family.variants.some((v) => v.weight === next.weight)) {
        const weights = [...new Set(family.variants.map((v) => v.weight))].join(", ");
        throw new CommandFailure(
          "text.weight_unavailable",
          `"${family.family}" has no weight ${next.weight}; available: ${weights}`,
        );
      }
    }
    writeStyle(ctx, clipIds, style);
    return clipIds.map((id) => store.getState().clips[id]);
  },
});

/** Applies a ready-made look to a text clip (and places it in the frame, for the lower third). */
export const applyTextPreset = defineCommand({
  id: "text.applyPreset",
  label: "Apply text preset",
  description:
    "Applies a preset look to a text clip: title, highlight, outline, pop or lower-third. A preset sets size, weight, colors, outline, background and shadow (the font family stays); lower-third also left-aligns the text and moves it to the lower left of the frame. Sizes follow the frame's short side. Returns the clip.",
  undoable: true,
  input: z.object({ clipId: z.string(), preset: textPresetId }),
  async run(ctx, { clipId, preset }) {
    textClipOf(ctx, clipId);
    const store = ctx.require(projectRef).store;
    const format = store.getState().format;
    writeStyle(ctx, [clipId], presetStyle(preset, format));
    const transform = presetTransform(preset, format);
    if (transform) await ctx.execute(setClipTransform, { clipId, ...transform });
    return store.getState().clips[clipId];
  },
});

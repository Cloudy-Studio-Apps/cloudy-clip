import { z } from "zod";
import { CommandFailure, defineCommand, type CommandContext } from "@/core";
import { fontsRef } from "@/modules/fonts";
import { minimizeProps } from "@/modules/element";
import { projectRef, type Clip, type ProjectFormat } from "@/modules/project";
import {
  DEFAULT_TEXT,
  clipText,
  defaultTextStyle,
  isTextClip,
  mergeTextStyle,
  textStyleOf,
} from "./logic/layout";
import type { TextStyle } from "./text.types";
import { setClipTransform } from "@/modules/transform";
import { presetStyle, presetTransform } from "./logic/presets";
import { checkExplicitFace } from "./logic/faces";
import { snapStyleToFamily } from "./logic/snap";
import { textPresetId, textStylePatch } from "./text.schema";

/** The text clip with this id, or the failure that tells why it is not one. */
function textClipOf(ctx: CommandContext, clipId: string): Clip {
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
    const clip = store.getState().clips[clipId]!;
    const props = storedProps(
      text,
      textStyleOf(clip, store.getState().format),
      store.getState().format,
    );
    ctx.mutate(store, (draft) => {
      draft.clips[clipId]!.props = props;
    });
    return store.getState().clips[clipId];
  },
});

/** What a text clip stores: its words and style, minus what equals the defaults. */
function storedProps(text: string, style: TextStyle, format: ProjectFormat) {
  return minimizeProps({ text, ...style }, { text: DEFAULT_TEXT, ...defaultTextStyle(format) });
}

/** Writes the finished styles (by clip id); the clips are validated by the caller. */
function writeStyles(ctx: CommandContext, styles: ReadonlyMap<string, TextStyle>) {
  const store = ctx.require(projectRef).store;
  const { clips, format } = store.getState();
  const props = [...styles].map(
    ([id, style]) => [id, storedProps(clipText(clips[id]!), style, format)] as const,
  );
  ctx.mutate(store, (draft) => {
    for (const [id, value] of props) draft.clips[id]!.props = value;
  });
}

/** Changes the look of one or more text clips; only the given fields change. */
export const setTextStyle = defineCommand({
  id: "text.setStyle",
  label: "Style text",
  description:
    "Changes how text clips look; fields left out keep their value, nested groups (fill, outline, background, shadow) merge field by field. Sizes, padding, outline width, blur and distance are output pixels; colors are #rrggbb; opacities 0-1; shadow angle in degrees (90 = down). font is { family, source } with source bundled, installed or google: list the choices with fonts_list. Weight and italic follow the font: when you change the font without naming them they move to the closest face it has; asking for a weight or italic the family lacks fails (text.weight_unavailable, text.italic_unavailable). All clips are checked first, so a bad one changes nothing. Returns the clips.",
  undoable: true,
  input: z.object({ clipIds: z.array(z.string()).min(1), style: textStylePatch }),
  run(ctx, { clipIds, style }) {
    const store = ctx.require(projectRef).store;
    const format = store.getState().format;
    const clips = clipIds.map((id) => textClipOf(ctx, id));
    // Only a list that is already loaded is checked; commands never wait for the network.
    const families = ctx.require(fontsRef).knownFamilies();
    const styles = new Map<string, TextStyle>();
    for (const clip of clips) {
      const merged = mergeTextStyle(textStyleOf(clip, format), style);
      checkExplicitFace(merged, style, families);
      styles.set(clip.id, snapStyleToFamily(merged, families));
    }
    writeStyles(ctx, styles);
    return clipIds.map((id) => store.getState().clips[id]);
  },
});

/** Applies a ready-made look to a text clip (and places it in the frame, for the lower third). */
export const applyTextPreset = defineCommand({
  id: "text.applyPreset",
  label: "Apply text preset",
  description:
    "Applies a preset look to a text clip: title, highlight, outline, pop or lower-third. A preset sets size, weight, colors, outline, background and shadow (the font family stays; weight and italic move to the closest face it has); lower-third also left-aligns the text and moves it to the lower left of the frame. Sizes follow the frame's short side. Returns the clip.",
  undoable: true,
  input: z.object({ clipId: z.string(), preset: textPresetId }),
  async run(ctx, { clipId, preset }) {
    const clip = textClipOf(ctx, clipId);
    const store = ctx.require(projectRef).store;
    const format = store.getState().format;
    const merged = mergeTextStyle(textStyleOf(clip, format), presetStyle(preset, format));
    writeStyles(
      ctx,
      new Map([[clipId, snapStyleToFamily(merged, ctx.require(fontsRef).knownFamilies())]]),
    );
    const transform = presetTransform(preset, format);
    if (transform) await ctx.execute(setClipTransform, { clipId, ...transform });
    return store.getState().clips[clipId];
  },
});

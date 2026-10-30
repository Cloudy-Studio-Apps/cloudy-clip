import { z } from "zod";
import { CommandFailure, defineCommand } from "@/core";
import { setProps } from "@/modules/element";
import { fontsRef } from "@/modules/fonts";
import { projectRef, formatOf } from "@/modules/project";
import { isTextClip, mergeTextStyle, textStyleOf } from "./logic/layout";
import { presetStyle, presetTransform } from "./logic/presets";
import { snapStyleToFamily } from "./logic/snap";
import { textPresetId } from "./text.schema";

/** Applies a ready-made look to text clips (and places them in the frame, for the lower third). */
export const applyTextPreset = defineCommand({
  id: "text.applyPreset",
  label: "Apply text preset",
  description:
    "Applies a preset look to one or more text clips: title, highlight, outline, pop or lower-third. A preset sets size, weight, colors, outline, background and shadow (the font family stays; weight and italic move to the closest face it has); lower-third also left-aligns the text and moves it to the lower left of the frame. Sizes follow the frame's short side. All clips change in one undo step. Returns the clips.",
  undoable: true,
  input: z.object({ clipIds: z.array(z.string()).min(1), preset: textPresetId }),
  async run(ctx, { clipIds, preset }) {
    const store = ctx.require(projectRef).store;
    const state = store.getState();
    const { clips } = state;
    const targets = clipIds.map((id) => {
      const clip = clips[id];
      if (!clip) throw new CommandFailure("text.clip_not_found", `No clip with id "${id}"`);
      if (!isTextClip(clip)) {
        throw new CommandFailure("text.not_text", `Clip "${id}" is not a text clip`);
      }
      return clip;
    });
    const families = ctx.require(fontsRef).knownFamilies();
    for (const clip of targets) {
      const format = formatOf(state, clip);
      const style = presetStyle(preset, format);
      const transform = presetTransform(preset, format);
      // A preset's weight and italic move to the closest face the family has (never fail).
      const face = snapStyleToFamily(mergeTextStyle(textStyleOf(clip, format), style), families);
      // One patch per clip: the style and (lower third) the place, checked and written together.
      await ctx.execute(setProps, {
        clipIds: [clip.id],
        patch: {
          ...style,
          weight: face.weight,
          italic: face.italic,
          ...(transform && { transform }),
        },
      });
    }
    const after = store.getState();
    return clipIds.map((id) => after.clips[id]);
  },
});

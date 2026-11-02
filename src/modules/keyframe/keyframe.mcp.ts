import { z } from "zod";
import { commandTool, defineMcpTool, errorResult, textResult } from "@/core";
import { EASE_PRESETS, animatedClip, projectRef } from "@/modules/project";
import { copyKeys, pasteKeys } from "./keyframe.clipboard.commands";
import { clearKeys } from "./keyframe.commands";
import { scaleKeys, setAfter, setEase } from "./keyframe.ease.commands";
import { moveKeys, removeKeys, setKey, setKeys, setKeyValues } from "./keyframe.edit.commands";
import { time } from "./keyframe.guards";
import { keyframeRef } from "./keyframe.ref";

const MAX_SAMPLES = 1000;

/** Reads a field's value at times along the timeline. */
const sample = defineMcpTool({
  name: "keyframe_sample",
  readOnly: true,
  description: `Returns the value of a clip's field from "from" to "to" (timeline times, microseconds) every "step" microseconds, as [{ time, value }], at most ${MAX_SAMPLES} samples. Works on fields with or without keys, so you can check a curve without rendering.`,
  input: z.object({
    clipId: z.string(),
    path: z.string(),
    from: time,
    to: time,
    step: z.number().int().min(1),
  }),
  handler(input, ctx) {
    const clip = ctx.require(projectRef).store.getState().clips[input.clipId];
    const found = clip && ctx.require(keyframeRef).fieldOf(clip, input.path);
    if (!clip) {
      return errorResult({ code: "keyframe.clip_not_found", message: `No clip "${input.clipId}"` });
    }
    if (!found) {
      return errorResult({
        code: "keyframe.not_keyable",
        message: `"${input.path}" can't be keyed on this clip`,
      });
    }
    const count = input.to < input.from ? 0 : Math.floor((input.to - input.from) / input.step) + 1;
    if (count > MAX_SAMPLES) {
      return errorResult({
        code: "keyframe.too_many_samples",
        message: `${count} samples asked, at most ${MAX_SAMPLES}: raise "step" or narrow the range`,
      });
    }
    return textResult(
      Array.from({ length: count }, (_, i) => {
        const at = input.from + i * input.step;
        return { time: at, value: found.field.read(animatedClip(clip, at)) };
      }),
    );
  },
});

/** Lists the ease presets by name. */
const listEases = defineMcpTool({
  name: "keyframe_list_eases",
  readOnly: true,
  description:
    'Returns the ease presets, in order, as [{ id, label, ease }]. Pass an id as "ease" to keyframe_set_ease, or the ease object itself.',
  input: z.object({}),
  handler: () => textResult(EASE_PRESETS),
});

/** Agents key and edit keys with the same commands as the user. */
export const keyframeMcpTools = [
  commandTool(setKey, { name: "keyframe_set" }),
  commandTool(setKeys, { name: "keyframe_set_many" }),
  commandTool(removeKeys, { name: "keyframe_remove" }),
  commandTool(moveKeys, { name: "keyframe_move" }),
  commandTool(setKeyValues, { name: "keyframe_set_values" }),
  commandTool(clearKeys, { name: "keyframe_clear" }),
  commandTool(setEase, { name: "keyframe_set_ease" }),
  commandTool(setAfter, { name: "keyframe_set_after" }),
  commandTool(scaleKeys, { name: "keyframe_scale" }),
  commandTool(copyKeys, { name: "keyframe_copy" }),
  commandTool(pasteKeys, { name: "keyframe_paste" }),
  sample,
  listEases,
];

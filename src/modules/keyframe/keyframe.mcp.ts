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

/** Lists every field of a clip that can hold keys, its own and those other modules add. */
const listFields = defineMcpTool({
  name: "keyframe_list_fields",
  readOnly: true,
  description:
    'Returns every field of a clip that can hold keys, as [{ path, label, blend, min, max, values, loops, animated }]: the element\'s fields and those other modules add, like "sound.volumeDb", "sound.pan" and "speed.rate". Pass "path" to keyframe_set. "blend" is how values move between keys (number, color or step), "values" the allowed values of a step field, "loops" false where keyframe_set_after can\'t loop the track, "animated" whether it has keys.',
  input: z.object({ clipId: z.string() }),
  handler(input, ctx) {
    const clip = ctx.require(projectRef).store.getState().clips[input.clipId];
    if (!clip) {
      return errorResult({ code: "keyframe.clip_not_found", message: `No clip "${input.clipId}"` });
    }
    return textResult(
      ctx
        .require(keyframeRef)
        .fieldsOf(clip)
        .map(({ path, label, blend, min, max, values, loops }) => ({
          path,
          label,
          blend,
          ...(min !== undefined && { min }),
          ...(max !== undefined && { max }),
          ...(values && { values }),
          loops: loops ?? true,
          animated: clip.animation?.[path] !== undefined,
        })),
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
  listFields,
  listEases,
];

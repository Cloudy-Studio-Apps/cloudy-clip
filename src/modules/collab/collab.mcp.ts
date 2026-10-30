import { z } from "zod";
import { defineMcpTool, textResult } from "@/core";
import { previewRef } from "@/modules/preview";
import { timelineRef } from "@/modules/timeline";

const userContext = defineMcpTool({
  name: "collab_get_user_context",
  description:
    'Tells you where the user is: their playhead (`time`, microseconds), whether they are playing, and the clips and junctions they selected. Use it when they say things like "cut here" or "this clip". Your own playhead is separate.',
  readOnly: true,
  input: z.object({}),
  handler(_input, ctx) {
    const { playback } = ctx.require(previewRef);
    const { selection, junctionSelection } = ctx.require(timelineRef).view.getState();
    return textResult({
      time: playback.getTime(),
      playing: playback.isPlaying(),
      selection,
      junctionSelection,
    });
  },
});

export const collabMcpTools = [userContext];

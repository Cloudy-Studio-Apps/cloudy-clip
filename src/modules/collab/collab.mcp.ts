import { z } from "zod";
import { defineMcpTool, LOCAL_ACTOR, textResult } from "@/core";
import { previewRef } from "@/modules/preview";
import { projectRef } from "@/modules/project";
import { timelineRef } from "@/modules/timeline";

const userContext = defineMcpTool({
  name: "collab_get_user_context",
  description:
    'Tells you where the user is: the composition they have open (`compositionId`), their playhead in it (`time`, microseconds), whether they are playing, and the clips and junctions they selected. Use it when they say things like "cut here" or "this clip". Your own playhead and open composition are separate: open theirs with composition_open before acting on a time.',
  readOnly: true,
  input: z.object({}),
  handler(_input, ctx) {
    const { playback } = ctx.require(previewRef);
    const { selection, junctionSelection } = ctx.require(timelineRef).view.getState();
    return textResult({
      compositionId: ctx.require(projectRef).view.openFor(LOCAL_ACTOR),
      time: playback.getTime(),
      playing: playback.isPlaying(),
      selection,
      junctionSelection,
    });
  },
});

export const collabMcpTools = [userContext];

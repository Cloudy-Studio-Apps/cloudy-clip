import { z } from "zod";
import { commandTool, defineMcpTool, errorResult, textResult } from "@/core";
import { projectRef } from "@/modules/project";
import { compositionBeats } from "./logic/beats";
import { cancelBeats, findBeats } from "./sound.beats.commands";
import { soundRef } from "./sound.ref";

/** The beats the timeline ticks and snaps to, in timeline time, and the find under way. */
const getBeats = defineMcpTool({
  name: "sound_get_beats",
  readOnly: true,
  description:
    "Reads the beats found so far (sound_find_beats) under the clips on audio tracks of your open composition (or compositionId), in timeline microseconds (clips inside a nested composition are not scanned), as the ruler's ticks show them and drags snap to them. Returns { beats, running (null, or { progress } 0 to 1), failed (why the last find failed on a file, or null) }. Beats are found by onset detection with thresholds tuned on synthetic sound: check them on the timeline. Fails with composition.not_found.",
  input: z.object({ compositionId: z.string().optional() }),
  handler({ compositionId }, ctx) {
    const project = ctx.require(projectRef);
    const { files, running, failed } = ctx.require(soundRef).beats.state.getState();
    let id: string;
    try {
      id = compositionId ?? project.view.requireOpen(ctx.caller.key).id;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return errorResult({ code: "composition.not_found", message });
    }
    if (!project.store.getState().compositions[id]) {
      return errorResult({ code: "composition.not_found", message: `No composition ${id}.` });
    }
    return textResult({
      beats: compositionBeats(project.store.getState(), id, files),
      running,
      failed,
    });
  },
});

/** The beat tools: find, cancel, read. */
export const soundBeatTools = [
  commandTool(findBeats, { name: "sound_find_beats" }),
  commandTool(cancelBeats, { name: "sound_cancel_beats" }),
  getBeats,
];

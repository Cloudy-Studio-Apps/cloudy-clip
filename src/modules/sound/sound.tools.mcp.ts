import { z } from "zod";
import { commandTool, defineMcpTool, errorResult, textResult } from "@/core";
import { projectRef } from "@/modules/project";
import { SILENCE_DEFAULTS } from "./logic/silence";
import { soundRef } from "./sound.ref";
import { stripSilence } from "./sound.tools.commands";

/** What sound_strip_silence would cut, without cutting. */
const findSilences = defineMcpTool({
  name: "sound_find_silences",
  readOnly: true,
  description: `Reads what sound_strip_silence would cut from clipIds, as { clips: [{ clipId, cuts: [{ start, end }] }], removed } in timeline microseconds, nothing changed. Silence is quieter than thresholdDb (default ${SILENCE_DEFAULTS.thresholdDb} dBFS) for at least minMs (default ${SILENCE_DEFAULTS.minMs}); padMs (default ${SILENCE_DEFAULTS.padMs}) of quiet stays on each side. A linked picture and sound are listed once, under the first clip named; clips with no sound file of their own are left out. It scans (a long file takes a while, two at a time) and keeps the result: sound_strip_silence only works from a scan with the same clipIds and values. A clip whose file has no sound comes back with noSound: true and no cuts. Empty cuts everywhere means nothing would be cut. Fails with sound.clip_not_found, sound.silence_failed (also when cancelled).`,
  input: z.object({
    clipIds: z.array(z.string()).min(1),
    thresholdDb: z.number().min(-90).max(0).default(SILENCE_DEFAULTS.thresholdDb),
    minMs: z.number().min(10).max(60_000).default(SILENCE_DEFAULTS.minMs),
    padMs: z.number().min(0).max(5_000).default(SILENCE_DEFAULTS.padMs),
  }),
  async handler({ clipIds, ...params }, ctx) {
    const state = ctx.require(projectRef).store.getState();
    const missing = clipIds.find((id) => !state.clips[id]);
    if (missing)
      return errorResult({ code: "sound.clip_not_found", message: `No clip ${missing}.` });
    try {
      const clips = await ctx.require(soundRef).silences.scan(clipIds, params);
      const removed = clips.reduce(
        (sum, { cuts }) => sum + cuts.reduce((s, cut) => s + cut.end - cut.start, 0),
        0,
      );
      return textResult({ clips, removed });
    } catch (error) {
      const message = error instanceof Error ? error.message : JSON.stringify(error);
      return errorResult({ code: "sound.silence_failed", message });
    }
  },
});

/** The quick-tool tools: strip silence, and read what it would cut. */
export const soundToolsTools = [
  commandTool(stripSilence, { name: "sound_strip_silence" }),
  findSilences,
];

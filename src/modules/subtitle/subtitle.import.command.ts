import { z } from "zod";
import { CommandFailure, defineCommand } from "@/core";
import { projectRef } from "@/modules/project";
import { addElement, addTrack, minClipDuration } from "@/modules/timeline";
import { laneOf } from "./logic/lanes";
import { parseSubtitles } from "./logic/srt";
import { requireComposition, requireStyle } from "./subtitle.guards";
import { mark } from "./subtitle.mark.commands";

/** Cues from `.srt` or `.vtt` text, as marked text clips on new top tracks. */
export const importSubtitles = defineCommand({
  id: "subtitle.import",
  label: "Import subtitles",
  description:
    'Reads the contents of an .srt or .vtt file ("text", "format") into your open composition or compositionId: one marked text clip per cue, on new top video tracks named "name" (default "Subtitles"; "name (2)" and on for cues that overlap earlier ones). Cues shorter than a frame are lengthened to one. Blocks that are not cues (no time line, no words, end not after start) are skipped and counted. Marked with "styleId" or the default style. One undo step. Fails with subtitle.empty_file when there is no cue, subtitle.style_not_found and subtitle.composition_not_found. Returns { clipIds, trackIds, skipped }.',
  undoable: true,
  input: z.object({
    compositionId: z.string().optional(),
    text: z.string(),
    format: z.enum(["srt", "vtt"]),
    name: z.string().min(1).max(50).optional(),
    styleId: z.string().optional(),
  }),
  async run(ctx, input) {
    const composition = requireComposition(ctx, input.compositionId);
    if (input.styleId !== undefined) {
      requireStyle(ctx.require(projectRef).store.getState(), input.styleId);
    }
    const { cues: read, skipped } = parseSubtitles(input.text);
    if (read.length === 0) {
      throw new CommandFailure("subtitle.empty_file", "The file has no subtitle cues.");
    }
    const min = minClipDuration(composition.format);
    const cues = read
      .map((cue) => ({ ...cue, end: Math.max(cue.end, cue.start + min) }))
      .sort((a, b) => a.start - b.start);
    const lanes = laneOf(cues);
    const name = input.name ?? "Subtitles";
    // Lanes are made from the last to the first, each on top, so the first ends up highest.
    const trackIds: string[] = [];
    for (let lane = Math.max(...lanes); lane >= 0; lane--) {
      const made = await ctx.execute(addTrack, {
        kind: "video",
        index: 0,
        name: lane === 0 ? name : `${name} (${lane + 1})`,
        compositionId: composition.id,
      });
      trackIds[lane] = made.trackId;
    }
    const clipIds: string[] = [];
    for (const [i, cue] of cues.entries()) {
      const clip = await ctx.execute(addElement, {
        kind: "text",
        props: { text: cue.text },
        start: cue.start,
        duration: cue.end - cue.start,
        trackId: trackIds[lanes[i]!]!,
      });
      clipIds.push(clip.id);
    }
    await ctx.execute(mark, { clipIds, styleId: input.styleId });
    return { clipIds, trackIds, skipped };
  },
});

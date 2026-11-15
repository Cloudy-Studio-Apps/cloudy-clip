import { z } from "zod";
import { CommandFailure, defineCommand } from "@/core";
import { INPUT_SPACES, projectRef, type ClipGrade } from "@/modules/project";
import { checkedGrade, readGrade, writeGrade } from "./tint.guards";

/**
 * Sets the camera color space of clips: their source is turned into Rec.709 from it before the
 * grade. Every clip is checked before anything is written; one undo step for all.
 */
export const setInput = defineCommand({
  id: "tint.setInput",
  label: "Camera color space",
  description:
    "Sets the camera color space of clips (input): rec709 (the default, no conversion), srgb, slog3 (Sony S-Log3 / S-Gamut3.Cine), appleLog, clog2 (Canon C-Log2 / Cinema Gamut), clog3 (Canon C-Log3 / Cinema Gamut), vlog (Panasonic V-Log / V-Gamut) or flog (Fujifilm F-Log / F-Gamut). The clip's picture is converted from it to Rec.709 before its first correction, from the makers' published formulas; light past white is kept for the grade (exposure or rolloff bring it back; the output clips at the end), colors outside Rec.709 are clipped at black. A video file is read as video range unless ffprobe found it full range; an image is full range. srgb matches display light (sRGB decoded, then encoded for the gamma 2.4 output). Grading happens in Rec.709, output is Rec.709 gamma 2.4. Sources are decoded at 8 bits, so log footage can band. A composition clip is already Rec.709 and takes only rec709 (tint.input_not_for_composition). All clips change in one undo step, or none: fails with tint.target_not_found, tint.not_gradeable or tint.input_not_for_composition.",
  undoable: true,
  input: z.object({
    clipIds: z.array(z.string().min(1)).min(1),
    input: z.enum(INPUT_SPACES),
  }),
  run(ctx, { clipIds, input }) {
    const { store } = ctx.require(projectRef);
    const state = store.getState();
    const writes: [string, ClipGrade | undefined][] = [];
    for (const clipId of clipIds) {
      const grade = readGrade(state, { clipId });
      if (input !== "rec709" && state.clips[clipId]?.compositionRef !== undefined) {
        throw new CommandFailure(
          "tint.input_not_for_composition",
          `Clip "${clipId}" is a composition, whose picture is Rec.709 already: only rec709 applies.`,
        );
      }
      if ((grade?.input ?? "rec709") === input) continue;
      writes.push([clipId, checkedGrade({ nodes: {}, out: { node: "source" }, ...grade, input })]);
    }
    if (writes.length === 0) return;
    ctx.mutate(store, (draft) => {
      for (const [clipId, grade] of writes) writeGrade(draft, { clipId }, grade);
    });
  },
});

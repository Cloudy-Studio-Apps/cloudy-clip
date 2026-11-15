import { z } from "zod";
import { commandTool, defineMcpTool, errorResult, textResult } from "@/core";
import { projectRef } from "@/modules/project";
import { isStale, storedFor } from "./sound.analysis.store";
import { analyzeMix, cancelAnalysis, setDelivery, startMatch } from "./sound.delivery.commands";
import type { Analyzer, StoredAnalysis } from "./sound.delivery.types";
import { soundRef } from "./sound.ref";
import { waitBriefly } from "./sound.wait";

/** What the Deliver tab shows of a stored analysis: figures, problems, when, staleness, the last Match target. */
function reading(analyzer: Analyzer, id: string, stored: StoredAnalysis, stale: boolean) {
  const { matched, matchFailed } = analyzer.state.getState();
  return {
    ...stored.result,
    peakLimitDbtp: stored.peakDbtp,
    stale,
    measuredAt: new Date(stored.at).toISOString(),
    ...(matchFailed[id] && { matchFailed: matchFailed[id] }),
    ...(matched[id] && !stale && !matchFailed[id] && { matched: matched[id] }),
  };
}

/** The stored analysis when it describes the project as it is, else it measures; waits for the figures. */
const analyzeMixTool = defineMcpTool({
  name: "sound_analyze_mix",
  readOnly: true,
  description:
    "Reads the whole-mix analysis of your open composition (or compositionId) that the Deliver tab shows, and measures only when there is none, the document changed since (it is stale) or you pass fresh: true. Measuring is done without playing the mix and waited for (it can take minutes on a long mix, so call again while it runs; a fresh stored result costs nothing). Returns: integrated loudness (LUFS), loudness range (LU), true peak (dBTP; null for a silent mix), peakLimitDbtp (the delivery peak limit it looked for), problems (stretches over the peak limit, or clipped; at and duration in microseconds), stale (false once it is measured or read fresh), measuredAt (ISO time), matchFailed (why the last Match target failed, if it did) and matched (the last Match target's result, while the document is as it left it: { trimDb, changeDb, correctionDb, limiterAdded, limiterSwitched, limiterMoved, clamped, landed, peakOver }). Figures are of the mix before the codec: MP3, AAC and Opus can add a few tenths of a dB of true peak. Waits up to 25 s: if the analysis is still running it returns { running: true, progress }, and calling again keeps waiting for the same job. Fails like sound.analyzeMix: export.noSound, export.missingMedia, export.mediaNotReady, export.denoise_pending.",
  input: z.object({
    compositionId: z.string().optional(),
    fresh: z
      .boolean()
      .optional()
      .describe("Measure again even if the stored analysis describes the mix as it is"),
  }),
  async handler({ compositionId, fresh }, ctx) {
    const { analyzer } = ctx.require(soundRef);
    const project = ctx.require(projectRef);
    if (!fresh) {
      let open: string | undefined;
      try {
        open = compositionId ?? project.view.requireOpen(ctx.caller.key).id;
      } catch {
        // The command below reports a missing composition.
      }
      const kept = open === undefined ? undefined : storedFor(analyzer.state, open);
      if (open !== undefined && kept && !isStale(kept, project.store.getState())) {
        return textResult(reading(analyzer, open, kept, false));
      }
    }
    const started = await ctx.bus.execute(analyzeMix.id, { compositionId });
    if (!started.ok) return errorResult(started.error);
    const id = (started.value as { compositionId: string }).compositionId;
    // The bridge cuts a call at 30 s, so the wait is bounded; the job goes on and can be waited for again.
    const stored = await waitBriefly(analyzer.settled(id));
    if (stored === "late") {
      const progress = analyzer.state.getState().running[id]?.progress ?? 0;
      return textResult({
        running: true,
        progress,
        message:
          "The analysis is still running. Call sound_analyze_mix again to keep waiting for it, or sound_cancel_analysis to stop it.",
      });
    }
    if (!stored) {
      const why = analyzer.state.getState().failed[id];
      return errorResult({
        code: "sound.analysis_failed",
        message: why ?? "The analysis was cancelled.",
      });
    }
    return textResult(reading(analyzer, id, stored, isStale(stored, project.store.getState())));
  },
});

/** Brings the mix to the delivery target and waits for where it landed; the command returns at once. */
const matchTargetTool = defineMcpTool({
  name: "sound_match_target",
  description:
    "Brings the whole mix of your open composition (or compositionId) to its delivery target (sound_set_delivery), as the Deliver tab's Match target does, and waits for it: it uses the last analysis when fresh (or measures the mix; one still running for an older state of the project is cancelled, not waited for), raises or lowers Master's input trim by the gap (-24 to 24 dB, before the fader; the fader and its volume line are not touched) and puts a Limiter at the end of Master's chain at the peak limit if it has none working (one that is off is switched on there), measures again with that on the side and corrects once (at most 3 dB more, so the limiter isn't left doing all the work; a limiter of its own comes down when the true peak went over), then makes the one change (one undo step) and analyzes where the mix landed. Returns { trimDb, changeDb, correctionDb, limiterAdded, limiterSwitched, limiterMoved (an off limiter was switched on, and moved to the end of Master's chain), clamped (the trim's range kept it from the target), landed: { integrated, truePeak, problems, ... }, peakOver (null, or { overDb, userLimiter } when the last measured true peak is still over the peak limit: it is not measured a third time) }. If the project changes while it runs, it changes nothing. Waits up to 25 s, then returns { running: true, ... } while it still runs; calling again waits for the same one; sound_cancel_analysis stops it. Fails with sound.silent_mix-like messages (sound.match_failed), export.noSound, export.missingMedia, export.mediaNotReady, export.denoise_pending.",
  input: z.object({ compositionId: z.string().optional() }),
  async handler(input, ctx) {
    const started = await ctx.bus.execute(startMatch.id, input);
    if (!started.ok) return errorResult(started.error);
    const { compositionId } = started.value as { compositionId: string };
    const { analyzer, matcher } = ctx.require(soundRef);
    const outcome = await waitBriefly(matcher.settled(compositionId));
    if (outcome === "late") {
      return textResult({
        running: true,
        ...analyzer.state.getState().matching[compositionId],
        message:
          "Match target is still running. Call sound_match_target again to keep waiting for it, or sound_cancel_analysis to stop it.",
      });
    }
    if (!outcome) {
      const why = analyzer.state.getState().matchFailed[compositionId];
      return errorResult({
        code: "sound.match_failed",
        message: why ?? "Match target was cancelled.",
      });
    }
    return textResult(outcome);
  },
});

/** The Deliver tab's tools: analyze the mix, match the target, set the target, cancel. */
export const soundDeliveryTools = [
  analyzeMixTool,
  commandTool(cancelAnalysis, { name: "sound_cancel_analysis" }),
  matchTargetTool,
  commandTool(setDelivery, { name: "sound_set_delivery" }),
];

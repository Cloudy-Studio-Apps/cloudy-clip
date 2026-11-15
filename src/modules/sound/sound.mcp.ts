import { z } from "zod";
import { commandTool, defineMcpTool, errorResult, textResult } from "@/core";
import { previewRef, type StereoLevel } from "@/modules/preview";
import {
  addEffect,
  applyPreset,
  moveEffect,
  removeEffect,
  setEffect,
} from "./sound.effects.commands";
import { BUILT_IN_PRESETS } from "./logic/presets";
import { analyzeMix, cancelAnalysis, setDelivery, startMatch } from "./sound.delivery.commands";
import { writeClipPass } from "./sound.clipline.commands";
import { measureFloor } from "./sound.denoise.commands";
import {
  moveLineKeys,
  removeLineKeys,
  setLineKey,
  writePass,
  writePasses,
} from "./sound.line.commands";
import { projectRef } from "@/modules/project";
import { soundBeatTools } from "./sound.beats.mcp";
import { soundToolsTools } from "./sound.tools.mcp";
import { isStale, storedFor } from "./sound.analysis.store";
import type { Analyzer, StoredAnalysis } from "./sound.delivery.types";
import { soundRef } from "./sound.ref";
import { addBus, removeBus, sendTo, setBus } from "./sound.bus.commands";
import { resetTrackMix, setMaster, setTrackMix, switchMix } from "./sound.mix.commands";

/** A level for JSON: dBFS to a tenth, null for silence (JSON has no -Infinity). */
const level = (db: number): number | null =>
  Number.isFinite(db) ? Math.round(db * 10) / 10 : null;
const stereo = ({ left, right }: StereoLevel) => ({ left: level(left), right: level(right) });

/** What the user hears right now: meters and loudness. They exist only while the user plays. */
const getLevels = defineMcpTool({
  name: "sound_get_levels",
  readOnly: true,
  description:
    "Returns what the user hears right now in the preview: the peak of each audio track of their open composition and of the master (dBFS, null for silence), and the loudness of the master over all the playing since the user last pressed Reset (momentary, short term and integrated LUFS, range in LU, true peak in dBTP, and the stereo correlation of left and right from -1 to 1, where 0 or more is mono safe; null where not measured yet). Readings exist only while the user plays; when nothing plays you get a message and the loudness kept from the last play. Your own playhead plays nothing, so this never measures your edits by itself.",
  input: z.object({}),
  handler(_input, ctx) {
    const preview = ctx.require(previewRef);
    const reading = preview.sound.loudness();
    const loudness = reading && {
      momentary: level(reading.momentary),
      shortTerm: level(reading.shortTerm),
      integrated: level(reading.integrated),
      range: level(reading.range),
      truePeak: level(reading.truePeak),
      correlation: reading.momentary > -Infinity ? reading.correlation : null,
    };
    if (!preview.playback.isPlaying()) {
      return textResult({
        playing: false,
        message:
          "Nothing is playing: meter levels exist only while the user plays the preview. Ask them to play it, then call this again.",
        loudness,
      });
    }
    const levels = preview.sound.levels();
    return textResult({
      playing: true,
      tracks: Object.fromEntries(
        Object.entries(levels.tracks).map(([trackId, side]) => [trackId, stereo(side)]),
      ),
      master: stereo(levels.master),
      loudness,
    });
  },
});

/** The presets that can be applied, with what they hold. */
const listPresets = defineMcpTool({
  name: "sound_list_presets",
  readOnly: true,
  description:
    "Lists the sound presets that sound_apply_preset takes: id, name, what it is for and the effects it puts on a track or the master. The built-in ones come first; those with own: true are the user's, saved by them (you can apply them, not change them).",
  input: z.object({}),
  handler: (_input, ctx) =>
    textResult([
      ...BUILT_IN_PRESETS.map(({ id, name, description, effects }) => ({
        id,
        name,
        description,
        effects,
      })),
      ...ctx
        .require(soundRef)
        .presets.getState()
        .presets.map(({ id, name, effects }) => ({ id, name, own: true, effects })),
    ]),
});

/** How long the tool waits for an analysis before saying it still runs. */
const ANALYSIS_WAIT_MS = 4 * 60_000;

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
    "Reads the whole-mix analysis of your open composition (or compositionId) that the Deliver tab shows, and measures only when there is none, the document changed since (it is stale) or you pass fresh: true. Measuring is done without playing the mix and waited for (it can take minutes on a long mix; a fresh stored result costs nothing). Returns: integrated loudness (LUFS), loudness range (LU), true peak (dBTP; null for a silent mix), peakLimitDbtp (the delivery peak limit it looked for), problems (stretches over the peak limit, or clipped; at and duration in microseconds), stale (false once it is measured or read fresh), measuredAt (ISO time), matchFailed (why the last Match target failed, if it did) and matched (the last Match target's result, while the document is as it left it: { trimDb, changeDb, correctionDb, limiterAdded, limiterSwitched, limiterMoved, clamped, landed, peakOver }). Figures are of the mix before the codec: MP3, AAC and Opus can add a few tenths of a dB of true peak. Waits up to four minutes: if the analysis is still running it says so, and calling again keeps waiting for the same job. Fails like sound.analyzeMix: export.noSound, export.missingMedia, export.mediaNotReady, export.denoise_pending.",
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
    // The bridge gives no abort signal, so the wait is bounded; the job goes on and can be waited for again.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const late = new Promise<"late">((resolve) => {
      timer = setTimeout(() => resolve("late"), ANALYSIS_WAIT_MS);
    });
    const stored = await Promise.race([analyzer.settled(id), late]);
    clearTimeout(timer);
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
    "Brings the whole mix of your open composition (or compositionId) to its delivery target (sound_set_delivery), as the Deliver tab's Match target does, and waits for it: it uses the last analysis when fresh (or measures the mix; one still running for an older state of the project is cancelled, not waited for), raises or lowers Master's input trim by the gap (-24 to 24 dB, before the fader; the fader and its volume line are not touched) and puts a Limiter at the end of Master's chain at the peak limit if it has none working (one that is off is switched on there), measures again with that on the side and corrects once (at most 3 dB more, so the limiter isn't left doing all the work; a limiter of its own comes down when the true peak went over), then makes the one change (one undo step) and analyzes where the mix landed. Returns { trimDb, changeDb, correctionDb, limiterAdded, limiterSwitched, limiterMoved (an off limiter was switched on, and moved to the end of Master's chain), clamped (the trim's range kept it from the target), landed: { integrated, truePeak, problems, ... }, peakOver (null, or { overDb, userLimiter } when the last measured true peak is still over the peak limit: it is not measured a third time) }. If the project changes while it runs, it changes nothing. Waits up to four minutes, then says it still runs; calling again waits for the same one; sound_cancel_analysis stops it. Fails with sound.silent_mix-like messages (sound.match_failed), export.noSound, export.missingMedia, export.mediaNotReady, export.denoise_pending.",
  input: z.object({ compositionId: z.string().optional() }),
  async handler(input, ctx) {
    const started = await ctx.bus.execute(startMatch.id, input);
    if (!started.ok) return errorResult(started.error);
    const { compositionId } = started.value as { compositionId: string };
    const { analyzer, matcher } = ctx.require(soundRef);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const late = new Promise<"late">((resolve) => {
      timer = setTimeout(() => resolve("late"), ANALYSIS_WAIT_MS);
    });
    const outcome = await Promise.race([matcher.settled(compositionId), late]);
    clearTimeout(timer);
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

/** Agents mix with the same commands as the user, and read the meters. Solo and monitoring stay the user's. */
export const soundMcpTools = [
  commandTool(setTrackMix, { name: "sound_set_track_mix" }),
  commandTool(resetTrackMix, { name: "sound_reset_track_mix" }),
  commandTool(setMaster, { name: "sound_set_master" }),
  commandTool(switchMix, { name: "sound_switch_mix" }),
  commandTool(addBus, { name: "sound_add_bus" }),
  commandTool(setBus, { name: "sound_set_bus" }),
  commandTool(removeBus, { name: "sound_remove_bus" }),
  commandTool(sendTo, { name: "sound_send_to" }),
  commandTool(setLineKey, { name: "sound_set_line_key" }),
  commandTool(moveLineKeys, { name: "sound_move_line_keys" }),
  commandTool(removeLineKeys, { name: "sound_remove_line_keys" }),
  commandTool(writePass, { name: "sound_write_pass" }),
  commandTool(writePasses, { name: "sound_write_passes" }),
  commandTool(writeClipPass, { name: "sound_write_clip_pass" }),
  commandTool(addEffect, { name: "sound_add_effect" }),
  commandTool(setEffect, { name: "sound_set_effect" }),
  commandTool(removeEffect, { name: "sound_remove_effect" }),
  commandTool(moveEffect, { name: "sound_move_effect" }),
  commandTool(applyPreset, { name: "sound_apply_preset" }),
  analyzeMixTool,
  commandTool(cancelAnalysis, { name: "sound_cancel_analysis" }),
  matchTargetTool,
  commandTool(setDelivery, { name: "sound_set_delivery" }),
  commandTool(measureFloor, { name: "sound_measure_floor" }),
  listPresets,
  getLevels,
  ...soundBeatTools,
  ...soundToolsTools,
];

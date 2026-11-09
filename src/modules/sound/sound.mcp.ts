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
import { analyzeMix, cancelAnalysis, matchTarget, setDelivery } from "./sound.delivery.commands";
import { writeClipPass } from "./sound.clipline.commands";
import { measureFloor } from "./sound.denoise.commands";
import {
  moveLineKeys,
  removeLineKeys,
  setLineKey,
  writePass,
  writePasses,
} from "./sound.line.commands";
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
    "Returns what the user hears right now in the preview: the peak of each audio track of their open composition and of the master (dBFS, null for silence), and the loudness of the master over all the playing since the user last pressed Reset (momentary, short term and integrated LUFS, range in LU, true peak in dBTP; null where not measured yet). Readings exist only while the user plays; when nothing plays you get a message and the loudness kept from the last play. Your own playhead plays nothing, so this never measures your edits by itself.",
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

/** Measures the whole mix and waits for the figures; the command itself returns at once. */
const analyzeMixTool = defineMcpTool({
  name: "sound_analyze_mix",
  readOnly: true,
  description:
    "Measures the whole mix of your open composition (or compositionId) without playing it, and waits for the result (it can take a while on a long mix): integrated loudness (LUFS), loudness range (LU), true peak (dBTP), the delivery target and peak limit it was measured against, and problems (stretches over the peak limit, or clipped; at and duration in microseconds). The result stays until the document changes, then it is stale; sound_match_target needs a fresh one. Waits up to four minutes: if the analysis is still running it says so, and calling again keeps waiting for the same job. Fails like sound.analyzeMix: export.noSound, export.missingMedia, export.mediaNotReady, export.denoise_pending.",
  input: z.object({ compositionId: z.string().optional() }),
  async handler(input, ctx) {
    const started = await ctx.bus.execute(analyzeMix.id, input);
    if (!started.ok) return errorResult(started.error);
    const { compositionId } = started.value as { compositionId: string };
    const { analyzer } = ctx.require(soundRef);
    // The bridge gives no abort signal, so the wait is bounded; the job goes on and can be waited for again.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const late = new Promise<"late">((resolve) => {
      timer = setTimeout(() => resolve("late"), ANALYSIS_WAIT_MS);
    });
    const stored = await Promise.race([analyzer.settled(compositionId), late]);
    clearTimeout(timer);
    if (stored === "late") {
      const progress = analyzer.state.getState().running[compositionId]?.progress ?? 0;
      return textResult({
        running: true,
        progress,
        message:
          "The analysis is still running. Call sound_analyze_mix again to keep waiting for it, or sound_cancel_analysis to stop it.",
      });
    }
    if (!stored) {
      const why = analyzer.state.getState().failed[compositionId];
      return errorResult({
        code: "sound.analysis_failed",
        message: why ?? "The analysis was cancelled.",
      });
    }
    const { result, peakDbtp } = stored;
    return textResult({ ...result, peakLimitDbtp: peakDbtp });
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
  commandTool(matchTarget, { name: "sound_match_target" }),
  commandTool(setDelivery, { name: "sound_set_delivery" }),
  commandTool(measureFloor, { name: "sound_measure_floor" }),
  listPresets,
  getLevels,
];

import { z } from "zod";
import { commandTool, defineMcpTool, errorResult, textResult } from "@/core";
import { projectRef } from "@/modules/project";
import { SILENCE_DEFAULTS } from "./logic/silence";
import { soundRef } from "./sound.ref";
import { cancelScans, matchLevel, stripSilence } from "./sound.tools.commands";
import { waitBriefly } from "./sound.wait";

/** What a tool says when its scan outlasts its wait: the scan goes on, and a new call joins it. */
const stillRunning = (tool: string, progress: number) =>
  textResult({
    running: true,
    progress,
    message: `Still scanning. Call ${tool} again with the same values to keep waiting for it (it joins the same scan), or sound_cancel_scans to stop it.`,
  });

/** What sound_strip_silence would cut, without cutting. */
const findSilences = defineMcpTool({
  name: "sound_find_silences",
  readOnly: true,
  description: `Reads what sound_strip_silence would cut from clipIds, as { clips: [{ clipId, cuts: [{ start, end }] }], removed } in timeline microseconds, nothing changed. Silence is quieter than thresholdDb (default ${SILENCE_DEFAULTS.thresholdDb} dBFS) for at least minMs (default ${SILENCE_DEFAULTS.minMs}); padMs (default ${SILENCE_DEFAULTS.padMs}) of quiet stays on each side. A linked picture and sound are listed once, under the first clip named; clips with no sound file of their own are left out. It scans (a long file takes a while, two at a time) and keeps the result; it waits up to 25 s, then returns { running: true, progress } and the scan goes on: call again with the same values to keep waiting (it joins the same scan), sound_cancel_scans stops it. sound_strip_silence only works from a scan with the same clipIds and values. A clip whose file has no sound comes back with noSound: true and no cuts. Empty cuts everywhere means nothing would be cut. Fails with sound.clip_not_found, sound.silence_failed (also when cancelled).`,
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
    const { silences, scans } = ctx.require(soundRef);
    let progress = 0;
    try {
      const clips = await waitBriefly(
        silences.scan(clipIds, params, (p) => (progress = p), scans.signalOf(ctx.caller.key)),
      );
      if (clips === "late") return stillRunning("sound_find_silences", progress);
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

/** What sound_match_level would work from. */
const measureClips = defineMcpTool({
  name: "sound_measure_clips",
  readOnly: true,
  description:
    "Measures the integrated loudness (LUFS, BS.1770) of clipIds as { clips: [{ clipId, lufs, noSound? }] }, nothing changed. Each clip is measured as heard through its own volume (static or keyed) over the part of its file it plays between its trims and speed, before its fades, EQ, track and master; a later volume change makes the measurement stale. A picture clip is measured through its linked sound (listed under the sound clip). lufs is null for a silent clip; noSound: true for a clip with no sound of its own (text, an image, a held frame, a nested composition, a file with no sound stream). It measures (a long file takes a while, two at a time) and keeps the result; it waits up to 25 s, then returns { running: true, progress } and the measuring goes on: call again with the same clipIds to keep waiting (it joins the same measurement), sound_cancel_scans stops it. sound_match_level only works from a measurement of the same clipIds. Fails with sound.clip_not_found, sound.measure_failed (also when cancelled).",
  input: z.object({ clipIds: z.array(z.string()).min(1) }),
  async handler({ clipIds }, ctx) {
    const state = ctx.require(projectRef).store.getState();
    const missing = clipIds.find((id) => !state.clips[id]);
    if (missing)
      return errorResult({ code: "sound.clip_not_found", message: `No clip ${missing}.` });
    const { loudness, scans } = ctx.require(soundRef);
    let progress = 0;
    try {
      const clips = await waitBriefly(
        loudness.measure(clipIds, (p) => (progress = p), scans.signalOf(ctx.caller.key)),
      );
      if (clips === "late") return stillRunning("sound_measure_clips", progress);
      return textResult({ clips });
    } catch (error) {
      const message = error instanceof Error ? error.message : JSON.stringify(error);
      return errorResult({ code: "sound.measure_failed", message });
    }
  },
});

/** The quick-tool tools: strip silence and match level, and the reads that go before them. */
export const soundToolsTools = [
  commandTool(stripSilence, { name: "sound_strip_silence" }),
  findSilences,
  commandTool(matchLevel, { name: "sound_match_level" }),
  measureClips,
  commandTool(cancelScans, { name: "sound_cancel_scans" }),
];

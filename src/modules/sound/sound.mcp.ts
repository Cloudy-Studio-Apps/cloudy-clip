import { z } from "zod";
import { commandTool, defineMcpTool, textResult } from "@/core";
import { previewRef, type StereoLevel } from "@/modules/preview";
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
    "Returns what the user hears right now in the preview: the peak of each audio track of their open composition and of the master (dBFS, null for silence), and the loudness of the master since play started (momentary, short term and integrated LUFS, range in LU, true peak in dBTP; null where not measured yet). Readings exist only while the user plays; when nothing plays you get a message and the loudness kept from the last play. Your own playhead plays nothing, so this never measures your edits by itself.",
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

/** Agents mix with the same commands as the user, and read the meters. Solo and monitoring stay the user's. */
export const soundMcpTools = [
  commandTool(setTrackMix, { name: "sound_set_track_mix" }),
  commandTool(resetTrackMix, { name: "sound_reset_track_mix" }),
  commandTool(setMaster, { name: "sound_set_master" }),
  commandTool(switchMix, { name: "sound_switch_mix" }),
  getLevels,
];

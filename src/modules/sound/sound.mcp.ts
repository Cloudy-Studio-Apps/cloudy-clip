import { z } from "zod";
import { commandTool, defineMcpTool, textResult } from "@/core";
import { previewRef, type StereoLevel } from "@/modules/preview";
import {
  addEffect,
  applyPreset,
  moveEffect,
  removeEffect,
  setEffect,
} from "./sound.effects.commands";
import { BUILT_IN_PRESETS } from "./logic/presets";
import { soundRef } from "./sound.ref";
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

/** Agents mix with the same commands as the user, and read the meters. Solo and monitoring stay the user's. */
export const soundMcpTools = [
  commandTool(setTrackMix, { name: "sound_set_track_mix" }),
  commandTool(resetTrackMix, { name: "sound_reset_track_mix" }),
  commandTool(setMaster, { name: "sound_set_master" }),
  commandTool(switchMix, { name: "sound_switch_mix" }),
  commandTool(addEffect, { name: "sound_add_effect" }),
  commandTool(setEffect, { name: "sound_set_effect" }),
  commandTool(removeEffect, { name: "sound_remove_effect" }),
  commandTool(moveEffect, { name: "sound_move_effect" }),
  commandTool(applyPreset, { name: "sound_apply_preset" }),
  listPresets,
  getLevels,
];

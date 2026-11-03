import { commandTool } from "@/core";
import { resetTrackMix, setMaster, setTrackMix, switchMix } from "./sound.mix.commands";

/** Agents mix with the same commands as the user. */
export const soundMcpTools = [
  commandTool(setTrackMix, { name: "sound_set_track_mix" }),
  commandTool(resetTrackMix, { name: "sound_reset_track_mix" }),
  commandTool(setMaster, { name: "sound_set_master" }),
  commandTool(switchMix, { name: "sound_switch_mix" }),
];

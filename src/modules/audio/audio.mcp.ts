import { commandTool } from "@/core";
import { resetSound, setSound } from "./audio.commands";

/** Agents change sound with the same commands as the user. */
export const audioMcpTools = [
  commandTool(setSound, { name: "audio_set_sound" }),
  commandTool(resetSound, { name: "audio_reset_sound" }),
];

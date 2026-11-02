import { commandTool } from "@/core";
import { freezeFrame, resetSpeed, setSpeed } from "./speed.commands";

/** Agents change speed with the same commands as the user. */
export const speedMcpTools = [
  commandTool(setSpeed, { name: "speed_set" }),
  commandTool(resetSpeed, { name: "speed_reset" }),
  commandTool(freezeFrame, { name: "speed_freeze_frame" }),
];

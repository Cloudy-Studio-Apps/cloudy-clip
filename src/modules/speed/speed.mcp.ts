import { commandTool } from "@/core";
import { resetSpeed, setSpeed } from "./speed.commands";

/** Agents change speed with the same commands as the user. */
export const speedMcpTools = [
  commandTool(setSpeed, { name: "speed_set" }),
  commandTool(resetSpeed, { name: "speed_reset" }),
];

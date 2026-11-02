import { commandTool } from "@/core";
import { createSolid, removeSolid, updateSolid } from "./solid.commands";

/** Agents manage library solids with the same commands as the user. */
export const solidMcpTools = [
  commandTool(createSolid, { name: "solid_create" }),
  commandTool(updateSolid, { name: "solid_update" }),
  commandTool(removeSolid, { name: "solid_remove" }),
];

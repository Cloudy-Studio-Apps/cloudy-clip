import { commandTool } from "@/core";
import { clearKeys } from "./keyframe.commands";
import { moveKeys, removeKeys, setKey, setKeyValues } from "./keyframe.edit.commands";

/** Agents key and edit keys with the same commands as the user. */
export const keyframeMcpTools = [
  commandTool(setKey, { name: "keyframe_set" }),
  commandTool(removeKeys, { name: "keyframe_remove" }),
  commandTool(moveKeys, { name: "keyframe_move" }),
  commandTool(setKeyValues, { name: "keyframe_set_values" }),
  commandTool(clearKeys, { name: "keyframe_clear" }),
];

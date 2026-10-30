import { commandTool } from "@/core";
import {
  createComposition,
  createFromMedia,
  deleteComposition,
  duplicateComposition,
  extendToFitOnce,
  openComposition,
  setMain,
  setSettings,
} from "./composition.commands";
import { groupClips } from "./composition.group.command";
import { placeComposition } from "./composition.place.command";
import { makeUnique } from "./composition.unique.command";

/** Agents create and set up compositions with the same commands as the user. */
export const compositionMcpTools = [
  commandTool(createComposition, { name: "composition_create" }),
  commandTool(createFromMedia, { name: "composition_create_from_media" }),
  commandTool(placeComposition, { name: "composition_place" }),
  commandTool(makeUnique, { name: "composition_make_unique" }),
  commandTool(groupClips, { name: "composition_group" }),
  commandTool(setSettings, { name: "composition_set_settings" }),
  commandTool(setMain, { name: "composition_set_main" }),
  commandTool(duplicateComposition, { name: "composition_duplicate" }),
  commandTool(deleteComposition, { name: "composition_delete" }),
  commandTool(extendToFitOnce, { name: "composition_extend_to_fit" }),
  commandTool(openComposition, { name: "composition_open", writes: true }),
];

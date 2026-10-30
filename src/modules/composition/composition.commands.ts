import { createComposition, createFromMedia } from "./composition.create.commands";
import { groupClips } from "./composition.group.command";
import {
  closeTab,
  deleteComposition,
  duplicateComposition,
  openComposition,
} from "./composition.library.commands";
import { placeComposition } from "./composition.place.command";
import { extendToFitOnce, setMain, setSettings } from "./composition.settings.commands";
import { makeUnique } from "./composition.unique.command";

export {
  closeTab,
  createComposition,
  createFromMedia,
  deleteComposition,
  duplicateComposition,
  extendToFitOnce,
  openComposition,
  setMain,
  setSettings,
};

export const compositionCommands = [
  createComposition,
  createFromMedia,
  setSettings,
  setMain,
  duplicateComposition,
  deleteComposition,
  extendToFitOnce,
  openComposition,
  closeTab,
  placeComposition,
  makeUnique,
  groupClips,
];

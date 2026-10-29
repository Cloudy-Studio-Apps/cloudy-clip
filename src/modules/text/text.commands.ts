import { addText } from "./text.add.command";
import { applyTextPreset } from "./text.preset.command";

export { addText, applyTextPreset };

/** Every command the text module registers. Words and style change with `element.setProps`. */
export const textCommands = [addText, applyTextPreset];

import { applyTextPreset } from "./text.preset.command";

export { applyTextPreset };

/**
 * Every command the text module registers. Texts are added with `timeline.addElement` and their
 * words and style change with `element.setProps`.
 */
export const textCommands = [applyTextPreset];

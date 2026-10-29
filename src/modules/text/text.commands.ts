import { addText } from "./text.add.command";
import { applyTextPreset, setText, setTextStyle } from "./text.style.commands";

export { addText, applyTextPreset, setText, setTextStyle };

/** Every command the text module registers. */
export const textCommands = [addText, setText, setTextStyle, applyTextPreset];

import type { PropertyControl } from "@/modules/inspector";
import { FontItalicControl } from "./FontItalicControl";
import { FontPickerControl } from "./FontPickerControl";
import { FontWeightControl } from "./FontWeightControl";
import { PresetRowControl } from "./PresetRowControl";

/** Controls the text panel needs beyond the built-in ones. */
export const textControls: PropertyControl[] = [
  { id: "font-picker", for: "field", component: FontPickerControl },
  { id: "font-weight", for: "field", component: FontWeightControl },
  { id: "font-italic", for: "field", component: FontItalicControl },
  { id: "preset-row", for: "command", component: PresetRowControl },
];

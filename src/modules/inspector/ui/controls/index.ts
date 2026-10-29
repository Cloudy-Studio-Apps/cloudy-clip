import type { PropertyControl } from "../../inspector.types";
import { ButtonControl } from "./ButtonControl";
import { ChoiceControl } from "./ChoiceControl";
import { ChoicesControl } from "./ChoicesControl";
import { ColorControl } from "./ColorControl";
import { IconToggleControl } from "./IconToggleControl";
import { NumberControl } from "./NumberControl";
import { SelectControl } from "./SelectControl";
import { SliderControl } from "./SliderControl";
import { TextareaControl } from "./TextareaControl";
import { TextControl } from "./TextControl";
import { ToggleControl } from "./ToggleControl";

/** The controls the inspector ships with, contributed to `propertyControls`. */
export const builtinControls: PropertyControl[] = [
  { id: "text", for: "field", component: TextControl },
  { id: "textarea", for: "field", component: TextareaControl },
  { id: "number", for: "field", component: NumberControl },
  { id: "slider", for: "field", component: SliderControl },
  { id: "dial", for: "field", component: NumberControl },
  { id: "toggle", for: "field", component: ToggleControl },
  { id: "icon-toggle", for: "field", component: IconToggleControl },
  { id: "color", for: "field", component: ColorControl },
  { id: "segmented", for: "field", component: ChoiceControl },
  { id: "select", for: "field", component: SelectControl },
  { id: "button", for: "command", component: ButtonControl },
  { id: "choices", for: "command", component: ChoicesControl },
];

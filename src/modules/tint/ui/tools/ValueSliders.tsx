import { DEFAULT_CORRECTION, type CorrectionValues } from "@/modules/project";
import type { LiveEdit } from "../ui.types";
import { GradeSlider } from "./GradeSlider";
import type { BasicField } from "./tools.types";

interface ValueSlidersProps {
  fields: readonly BasicField[];
  values: CorrectionValues;
  edit: LiveEdit;
}

/** Slider rows of a correction's numbers. Dragging shows live; release is one command; a double click on the label resets it. */
export function ValueSliders({ fields, values, edit }: ValueSlidersProps) {
  return (
    <div className="flex flex-col gap-1">
      {fields.map(({ key, label, step }) => (
        <GradeSlider
          key={key}
          path={key}
          label={label}
          step={step}
          value={values[key]}
          resetTo={DEFAULT_CORRECTION[key]}
          edit={edit}
          patch={(value) => ({ values: { [key]: value } })}
        />
      ))}
    </div>
  );
}

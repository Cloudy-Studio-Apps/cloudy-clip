import { DEFAULT_CORRECTION, GRADE_RANGES, type CorrectionValues } from "@/modules/project";
import { SliderField } from "@/ui";
import type { LiveEdit } from "../ui.types";
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
      {fields.map(({ key, label, step }) => {
        const { min, max } = GRADE_RANGES[key]!;
        return (
          <SliderField
            key={key}
            label={label}
            value={values[key]}
            min={min}
            max={max}
            step={step}
            disabled={!edit.enabled}
            resetTo={DEFAULT_CORRECTION[key]}
            onInput={(value) => edit.preview({ values: { [key]: value } })}
            onCommit={(value) => void edit.commit({ values: { [key]: value } })}
          />
        );
      })}
    </div>
  );
}

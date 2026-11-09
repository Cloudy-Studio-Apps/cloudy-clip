import { GRADE_RANGES } from "@/modules/project";
import { SliderField } from "@/ui";
import type { EditPatch, LiveEdit } from "../ui.types";

interface GradeSliderProps {
  /** The number's dotted path in `GRADE_RANGES` (`exposure`, `mix.reds.hue`), for its range. */
  path: string;
  label: string;
  step: number;
  value: number;
  /** What a double click on the label puts back. */
  resetTo: number;
  edit: LiveEdit;
  /** The patch that sets the number to `value`. */
  patch(value: number): EditPatch;
  /** Leaves out the label (still its accessible name), for a narrow column. */
  bare?: boolean;
}

/** A slider row of one number of a correction: live while dragging, one command on release (none when unchanged). */
export function GradeSlider({
  path,
  label,
  step,
  value,
  resetTo,
  edit,
  patch,
  bare,
}: GradeSliderProps) {
  const { min, max } = GRADE_RANGES[path]!;
  return (
    <SliderField
      label={label}
      value={value}
      min={min}
      max={max}
      step={step}
      disabled={!edit.enabled}
      resetTo={resetTo}
      bare={bare}
      onInput={(next) => edit.preview(patch(next))}
      onCommit={(next) => {
        if (next === value) edit.cancel();
        else void edit.commit(patch(next));
      }}
    />
  );
}

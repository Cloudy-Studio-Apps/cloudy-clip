import type { GradeLimit } from "@/modules/project";
import { SliderField } from "@/ui";
import type { LimitEdit } from "../ui.types";

interface LimitSliderProps {
  label: string;
  /** 0 to 100. */
  value: number;
  /** What a double click on the label puts back. */
  resetTo: number;
  disabled?: boolean;
  edit: LimitEdit;
  /** The limit with the number set to `value`. */
  limitWith(value: number): GradeLimit;
}

/** A 0 to 100 number of a limit (a softness, clean up): live while dragging, one command on release. */
export function LimitSlider({
  label,
  value,
  resetTo,
  disabled,
  edit,
  limitWith,
}: LimitSliderProps) {
  return (
    <SliderField
      label={label}
      value={value}
      min={0}
      max={100}
      step={1}
      disabled={disabled || !edit.enabled}
      resetTo={resetTo}
      onInput={(next) => edit.preview(limitWith(next))}
      onCommit={(next) => {
        if (next === value) edit.cancel();
        else edit.commit(limitWith(next));
      }}
    />
  );
}

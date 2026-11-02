import type { FieldAction, FieldActionProps } from "../inspector.types";
import { differs } from "../logic/reset";
import { ResetButton } from "./ResetButton";

/** Puts a row's values back to their defaults; shows only for subjects that can be reset. */
function ResetFieldAction({ paths, values, defaults, live, disabled }: FieldActionProps) {
  if (!live.reset || !defaults) return null;
  return (
    <ResetButton
      label="Reset"
      changed={!disabled && differs(paths, values, defaults)}
      onClick={() => live.reset?.(paths)}
    />
  );
}

/** The built-in field action. Words aren't reset: their default is only a placeholder. */
export const resetAction: FieldAction = {
  id: "reset",
  order: 100,
  appliesTo: (spec) => spec.multiline !== true,
  component: ResetFieldAction,
};

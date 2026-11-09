import type { Wheel } from "@/modules/project";
import type { EditPatch, LiveEdit } from "../ui.types";
import type { WheelEdit } from "./tools.types";

/**
 * A wheel's edit from the tool's: `patch` turns the wheel into the patch that writes it (the whole
 * top-level field, as `tint.setCorrection` replaces it); reset writes `neutral`, or nothing when
 * the wheel is already there.
 */
export function wheelEdit(
  edit: LiveEdit,
  current: Wheel,
  neutral: Wheel,
  patch: (wheel: Wheel) => EditPatch,
): WheelEdit {
  return {
    preview: (wheel) => edit.preview(patch(wheel)),
    commit: (wheel) => void edit.commit(patch(wheel)),
    cancel: edit.cancel,
    reset() {
      if (current.x !== neutral.x || current.y !== neutral.y || current.m !== neutral.m) {
        void edit.commit(patch(neutral));
      }
    },
  };
}

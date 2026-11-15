import { useEditTarget } from "./edit.target.hook";
import { useLiveEdit } from "./live.edit.hook";
import type { CorrectionValues } from "@/modules/project";
import type { LiveEdit } from "./ui.types";

/** What a tool's controls need: the values they show and the edit they send. */
export function useToolEdit(): { values: CorrectionValues; edit: LiveEdit } {
  const { subject, nodeId, values } = useEditTarget();
  return { values, edit: useLiveEdit(subject, nodeId) };
}

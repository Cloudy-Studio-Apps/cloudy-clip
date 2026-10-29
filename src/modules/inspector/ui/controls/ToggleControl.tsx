import { ToggleRow } from "@/ui";
import type { FieldControlProps } from "../../inspector.types";
import { pathPatch } from "../../logic/paths";

/** On or off, committed at once. */
export function ToggleControl({ path, value, label, disabled, live }: FieldControlProps) {
  return (
    <ToggleRow
      label={label}
      checked={value === true}
      disabled={disabled}
      onChange={(checked) => live.commit(pathPatch(path, checked))}
    />
  );
}

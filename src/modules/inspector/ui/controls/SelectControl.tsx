import { labelOf } from "@/modules/element";
import { SelectField } from "@/ui";
import type { FieldControlProps } from "../../inspector.types";
import { pathPatch } from "../../logic/paths";
import { FieldRow } from "./FieldRow";

/** One of many values in a select, committed at once. */
export function SelectControl({ path, spec, value, label, live }: FieldControlProps) {
  const options = (spec.values ?? []).map((v) => ({
    value: v,
    label: spec.labels?.[v] ?? labelOf(v),
  }));
  return (
    <FieldRow label={label}>
      <SelectField
        label={label}
        className="w-full"
        value={typeof value === "string" ? value : ""}
        options={options}
        onChange={(next) => live.commit(pathPatch(path, next))}
      />
    </FieldRow>
  );
}

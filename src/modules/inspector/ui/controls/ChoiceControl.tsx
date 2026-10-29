import { labelOf } from "@/modules/element";
import { SegmentedControl } from "@/ui";
import type { FieldControlProps } from "../../inspector.types";
import { pathPatch } from "../../logic/paths";
import { FieldRow } from "./FieldRow";

/** One of a few values as a segmented row (the `segmented` control), committed at once. */
export function ChoiceControl({ path, spec, value, label, live }: FieldControlProps) {
  const options = (spec.values ?? []).map((v) => ({
    value: v,
    label: spec.labels?.[v] ?? labelOf(v),
  }));
  return (
    <FieldRow label={label}>
      <SegmentedControl
        label={label}
        options={options}
        value={typeof value === "string" ? value : undefined}
        onChange={(next) => live.commit(pathPatch(path, next))}
      />
    </FieldRow>
  );
}

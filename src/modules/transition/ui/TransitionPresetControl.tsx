import { useModule } from "@/core";
import type { FieldControlProps } from "@/modules/inspector";
import { FieldRow } from "@/modules/inspector";
import { SelectField } from "@/ui";
import { transitionRef } from "../transition.ref";

/** The `transition-preset` control: a select of the registered presets, committed at once. */
export function TransitionPresetControl({ value, label, live, disabled }: FieldControlProps) {
  const transitions = useModule(transitionRef);
  const options = transitions.list().map((p) => ({ value: p.id, label: p.name }));
  return (
    <FieldRow label={label}>
      <SelectField
        label={label}
        className="w-full"
        value={typeof value === "string" ? value : ""}
        disabled={disabled}
        options={options}
        onChange={(next) => live.commit({ preset: next })}
      />
    </FieldRow>
  );
}

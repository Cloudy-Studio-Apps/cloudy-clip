import { NumberField } from "@/ui";
import type { FieldControlProps } from "../../inspector.types";
import { fromDisplay, toDisplay } from "../../logic/display";
import { pathPatch } from "../../logic/paths";
import { shownRange } from "./controls.range";
import { useFieldInline } from "./field.context";
import { FieldRow } from "./FieldRow";

/**
 * A number box; commits on Enter or blur. Inside a labelled row its label is a prefix that can be
 * dragged to scrub, live in the preview, one undo step on release. Also the `dial` control for now.
 */
export function NumberControl({ path, spec, value, label, live, disabled }: FieldControlProps) {
  const range = shownRange(spec);
  const inline = useFieldInline();
  const patch = (shown: number) => pathPatch(path, fromDisplay(shown, spec.display));
  return (
    <FieldRow label={label}>
      <NumberField
        label={label}
        prefix={inline ? label : undefined}
        className="w-full"
        value={Math.round(toDisplay(Number(value ?? 0), spec.display) * 100) / 100}
        min={toDisplay(spec.min ?? -Infinity, spec.display)}
        max={toDisplay(spec.max ?? Infinity, spec.display)}
        step={range.step}
        disabled={disabled}
        unit={range.unit}
        onInput={(shown) => live.input(patch(shown))}
        onChange={(shown) => live.commit(patch(shown))}
      />
    </FieldRow>
  );
}

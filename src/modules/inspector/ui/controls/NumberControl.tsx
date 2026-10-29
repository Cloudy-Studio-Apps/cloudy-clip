import { NumberField } from "@/ui";
import type { FieldControlProps } from "../../inspector.types";
import { fromDisplay, toDisplay } from "../../logic/display";
import { pathPatch } from "../../logic/paths";
import { shownRange } from "./controls.range";
import { FieldRow } from "./FieldRow";

/** A number box; commits on Enter or blur. Also the `dial` control for now. */
export function NumberControl({ path, spec, value, label, live }: FieldControlProps) {
  const range = shownRange(spec);
  return (
    <FieldRow label={label}>
      <NumberField
        label={label}
        className="w-full"
        value={Math.round(toDisplay(Number(value ?? 0), spec.display) * 100) / 100}
        min={toDisplay(spec.min ?? -Infinity, spec.display)}
        max={toDisplay(spec.max ?? Infinity, spec.display)}
        step={range.step}
        unit={range.unit}
        onChange={(shown) => live.commit(pathPatch(path, fromDisplay(shown, spec.display)))}
      />
    </FieldRow>
  );
}

import { SliderField } from "@/ui";
import type { FieldControlProps } from "../../inspector.types";
import { fromDisplay, toDisplay } from "../../logic/display";
import { pathPatch } from "../../logic/paths";
import { shownRange } from "./controls.range";
import { FieldRow } from "./FieldRow";

/** A slider plus number box: the drag shows live in the preview, the release is one undo step. */
export function SliderControl({ path, spec, value, label, live, disabled }: FieldControlProps) {
  const range = shownRange(spec);
  const patch = (shown: number) => pathPatch(path, fromDisplay(shown, spec.display));
  return (
    <FieldRow label={label}>
      <SliderField
        bare
        label={label}
        value={Math.round(toDisplay(Number(value ?? 0), spec.display) * 100) / 100}
        min={range.min}
        max={range.max}
        step={range.step}
        disabled={disabled}
        unit={range.unit}
        onInput={(shown) => live.input(patch(shown))}
        onCommit={(shown) => live.commit(patch(shown))}
      />
    </FieldRow>
  );
}

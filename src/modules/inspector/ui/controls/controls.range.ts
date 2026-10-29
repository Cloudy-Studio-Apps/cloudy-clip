import type { PropSpec } from "@/modules/element";
import { toDisplay } from "../../logic/display";

/** A number control's range, step and unit in shown values (the `ui` range first, then the spec's). */
export function shownRange(spec: PropSpec) {
  const scale = (n: number) => toDisplay(n, spec.display);
  return {
    min: scale(spec.ui?.min ?? spec.min ?? 0),
    max: scale(spec.ui?.max ?? spec.max ?? 100),
    step: scale(spec.ui?.step ?? spec.step ?? 1),
    unit: spec.display?.unit ?? spec.unit,
  };
}

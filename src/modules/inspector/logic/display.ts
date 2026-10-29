import type { PropUi } from "@/modules/element";

/** The value a control shows: the stored one times the display scale (opacity 0.6 → 60). */
export function toDisplay(value: number, display: PropUi["display"]): number {
  return value * (display?.scale ?? 1);
}

/** The value to store for a shown one (60 → 0.6). */
export function fromDisplay(shown: number, display: PropUi["display"]): number {
  return shown / (display?.scale ?? 1);
}

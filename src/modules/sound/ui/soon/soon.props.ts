import type { SoonId, SoonProps } from "../../sound.types";
import { SOON } from "./soon.catalog";

/** A click on a placeholder does nothing: no command, no store, no fake data. */
function nothing(): void {}

/**
 * The props a control that a later stage makes work spreads (Ruling 1): `aria-disabled`, the
 * tooltip "<label>: coming soon. <what>" from `SOON`, an arrow pointer, and a click that does
 * nothing. It keeps its normal look: the kit's buttons (`IconButton`, `ToolbarButton`, `Button`,
 * `LetterToggle`) and `TransportTool` drop their hover while `aria-disabled`. Never `disabled`,
 * which dims it.
 *
 * Spread it **after** the control's own `title` and `onClick`/`onToggle` props, or onto a
 * component that spreads extra props after its own (as `LetterToggle` and `IconButton` do), so
 * the tooltip and the do-nothing click are the ones that stay.
 */
export function soon(id: SoonId): SoonProps {
  const { label, what } = SOON[id];
  return {
    "aria-disabled": true,
    title: `${label}: coming soon. ${what}`,
    className: "cursor-default",
    onClick: nothing,
  };
}

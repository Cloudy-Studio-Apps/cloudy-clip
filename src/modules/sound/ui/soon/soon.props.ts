import type { MouseEvent } from "react";
import type { SoonId, SoonProps } from "../../sound.types";
import { SOON } from "./soon.catalog";

/**
 * Hover keeps the resting look: no background, and the muted ink the transport's tools and icon
 * buttons rest in. The pointer stays an arrow.
 */
const SOON_CLASS = "cursor-default hover:bg-transparent! hover:text-muted-foreground!";

/** A click on a placeholder does nothing: no command, no store, no fake data. */
function nothing(event: MouseEvent<HTMLElement>): void {
  event.preventDefault();
}

/**
 * The props a control that a later stage makes work spreads (Ruling 1): `aria-disabled`, the
 * tooltip "<label>: coming soon. <what>" from `SOON`, no hover highlight, and a click that only
 * prevents default. It keeps its normal look otherwise; never `disabled`, which dims it.
 */
export function soon(id: SoonId): SoonProps {
  const { label, what } = SOON[id];
  return {
    "aria-disabled": true,
    title: `${label}: coming soon. ${what}`,
    className: SOON_CLASS,
    onClick: nothing,
  };
}

import type { Gradient } from "@/modules/project";

/** The solid module's API: nothing yet. */
export type SolidApi = Record<string, never>;

/** What a solid paints: a flat color or a gradient. */
export interface SolidFill {
  fillType: "color" | "gradient";
  color: string;
  gradient: Gradient;
}

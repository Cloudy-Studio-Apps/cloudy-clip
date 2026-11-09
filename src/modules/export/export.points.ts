import { definePoint } from "@/core";
import type { LoudnessMatcher } from "./export.types";

/**
 * What measures a mix and works out how to bring it to its delivery target, for "Match the
 * delivery target" (`export.enqueue`'s `matchTarget`). `sound` contributes the one; the first is
 * used, and without one the option isn't offered.
 */
export const loudnessMatchers = definePoint<LoudnessMatcher>("export.loudnessMatchers", {
  keyOf: (matcher) => matcher.id,
});

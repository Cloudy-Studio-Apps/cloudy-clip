/**
 * Fonts module: the families text can use (bundled, installed, Google) and loading their faces.
 * @module fonts
 */
export { closestVariant, fontKey, nearestWeight, searchFamilies } from "./logic/variants";
export { createFakeFontsModule } from "./fonts.testing";
export type { FontFamily, FontRequest, FontStatus, FontsApi, FontVariant } from "./fonts.types";

/** Module definition, loaded by the app shell. */
export { fontsModule } from "./fonts.module";
/** Handle for `require(fontsRef)` / `useModule(fontsRef)`. */
export { fontsRef } from "./fonts.ref";

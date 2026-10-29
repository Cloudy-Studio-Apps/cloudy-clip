/**
 * Fonts module: the families text can use (bundled, installed, Google) and loading their faces.
 * @module fonts
 */
export { closestVariant, fontKey, nearestWeight, searchFamilies } from "./logic/variants";
export { createFakeFontsModule } from "./fonts.testing";
/** CSS names of font families: the Fontsource name of a bundled family, a quoted `font-family` list. */
export { bundledCssFamily, cssFontFamily } from "./logic/css";
export type {
  FontFamily,
  FontRef,
  FontRequest,
  FontSource,
  FontStatus,
  FontsApi,
  FontVariant,
  FontWeight,
} from "./fonts.types";

/** Module definition, loaded by the app shell. */
export { fontsModule } from "./fonts.module";
/** Handle for `require(fontsRef)` / `useModule(fontsRef)`. */
export { fontsRef } from "./fonts.ref";

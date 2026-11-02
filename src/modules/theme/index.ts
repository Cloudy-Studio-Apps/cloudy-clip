/**
 * Theme module: the themes of the interface, the user's choice among them, and applying it.
 * A theme never reaches the video: preview, capture and export read no theme value.
 * @module theme
 */
export type {
  ActiveTheme,
  ThemeApi,
  ThemeAppearance,
  ThemeChoice,
  ThemeCorners,
  ThemeDefinition,
  ThemeDensity,
  ThemeFonts,
  ThemeMode,
  ThemePreview,
  ThemeTokenName,
  ThemeTokens,
} from "./theme.types";

/** Every token a theme can set. */
export { THEME_TOKEN_NAMES } from "./logic/tokens";
/** Changes the user's theme choice. */
export { setTheme } from "./theme.commands";
/** Module definition, loaded by the app shell. */
export { themeModule } from "./theme.module";
/** The point themes are contributed to, and the helper that declares one. */
export { defineTheme, themes } from "./theme.points";
/** Handle for `require(themeRef)` / `useModule(themeRef)`. */
export { themeRef } from "./theme.ref";

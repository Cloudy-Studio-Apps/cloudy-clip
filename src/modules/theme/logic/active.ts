import { BASE_THEME_ID, resolveTheme } from "./resolve";
import type { ActiveTheme, ThemeAppearance, ThemeChoice, ThemeDefinition } from "../theme.types";

/** The built-in shown when the chosen theme isn't there. */
const FALLBACKS: Record<ThemeAppearance, string> = { dark: BASE_THEME_ID, light: "cloudy-light" };

/**
 * The theme `choice` shows. One that isn't there falls back to the built-in of the OS appearance
 * in `system` mode, or of the appearance last shown; the choice itself is left alone, so the
 * theme returns with its plugin.
 */
export function activeTheme(
  choice: ThemeChoice,
  systemDark: boolean,
  lastAppearance: ThemeAppearance,
  get: (id: string) => ThemeDefinition | undefined,
): ActiveTheme {
  const system = choice.mode === "system";
  const requestedId = system
    ? systemDark
      ? choice.darkThemeId
      : choice.lightThemeId
    : choice.themeId;
  const found = get(requestedId);
  const appearance = system ? (systemDark ? "dark" : "light") : lastAppearance;
  const definition = found ?? get(FALLBACKS[appearance]) ?? get(BASE_THEME_ID);
  if (!definition) throw new Error("The base theme isn't there.");
  return {
    requestedId,
    definition,
    resolved: resolveTheme(definition, get),
    missing: !found,
  };
}

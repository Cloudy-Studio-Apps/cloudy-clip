import { definePoint } from "@/core";
import type { ThemeDefinition } from "./theme.types";

/** Every theme (built-in and a plugin's). Keyed by `id`. Each is checked when read. */
export const themes = definePoint<ThemeDefinition>("theme.themes", {
  keyOf: (theme) => theme.id,
});

/** Declares a theme; contribute it to `themes`. */
export function defineTheme(def: ThemeDefinition): ThemeDefinition {
  return def;
}

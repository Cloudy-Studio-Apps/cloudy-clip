import { z } from "zod";
import { createSavedStore } from "@/core";
import { BASE_THEME_ID } from "./logic/resolve";
import type { ThemeChoice } from "./theme.types";

const CHOICE_KEY = "cloudy-clip.theme";

const DEFAULTS: ThemeChoice = {
  mode: "fixed",
  themeId: BASE_THEME_ID,
  lightThemeId: "cloudy-light",
  darkThemeId: BASE_THEME_ID,
  density: null,
};

const saved = z.object({
  mode: z.enum(["fixed", "system"]),
  themeId: z.string(),
  lightThemeId: z.string(),
  darkThemeId: z.string(),
  density: z.enum(["compact", "default", "comfortable"]).nullable(),
});

/** Creates the theme choice of one kernel, read from `localStorage` and saved on each change. */
export function createThemeChoice() {
  return createSavedStore<ThemeChoice>(CHOICE_KEY, saved, DEFAULTS);
}

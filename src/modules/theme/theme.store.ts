import { z } from "zod";
import { createStore } from "zustand/vanilla";
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

function load(): ThemeChoice {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(CHOICE_KEY) ?? "null");
    return saved.parse(raw);
  } catch {
    return DEFAULTS;
  }
}

function save(choice: ThemeChoice): void {
  try {
    localStorage.setItem(CHOICE_KEY, JSON.stringify(choice));
  } catch {
    // Storage can be blocked; the choice then lives for this session only.
  }
}

/** Creates the theme choice of one kernel, read from `localStorage` and saved on each change. */
export function createThemeChoice() {
  const store = createStore<ThemeChoice>()(() => load());
  store.subscribe(save);
  return store;
}

import { notify, type Logger, type PointReader } from "@/core";
import { activeTheme } from "./logic/active";
import { themeCss } from "./logic/css";
import { readTheme } from "./logic/read";
import { applyTheme, shownAppearance } from "./theme.apply";
import { themes } from "./theme.points";
import type { ThemeApi, ThemeChoice, ThemeDefinition } from "./theme.types";
import type { StoreApi } from "zustand/vanilla";

interface ThemeServiceDeps {
  points: PointReader;
  store: StoreApi<ThemeChoice>;
  log: Logger;
}

/** The themes that pass `readTheme`. A broken one is left out and reported; the rest still load. */
function readAll(contributed: readonly ThemeDefinition[], log: Logger): ThemeDefinition[] {
  return contributed.flatMap((data) => {
    try {
      const { theme, ignored } = readTheme(data);
      if (ignored.length > 0) {
        log.warn(`The theme "${theme.id}" sets tokens that don't exist: ${ignored.join(", ")}.`);
      }
      return [theme];
    } catch (error) {
      log.error("A theme was left out", error);
      notify("error", error instanceof Error ? error.message : "A theme could not be read.");
      return [];
    }
  });
}

/**
 * Keeps the page in the theme the choice asks for, as the user, the OS and the `themes` point
 * change it. Returns the module's API and a cleanup.
 */
export function createThemeService({ points, store, log }: ThemeServiceDeps) {
  const os = window.matchMedia("(prefers-color-scheme: dark)");
  const listeners = new Set<() => void>();
  let contributed: readonly ThemeDefinition[] | null = null;
  let valid: ThemeDefinition[] = [];
  let shownCss: string | null = null;

  const list = () => {
    const current = points.get(themes);
    if (current !== contributed) {
      contributed = current;
      valid = readAll(current, log);
    }
    return valid;
  };
  const get = (id: string) => list().find((theme) => theme.id === id);
  const active = () => activeTheme(store.getState(), os.matches, shownAppearance(), get);

  const apply = () => {
    if (list().length === 0) return;
    const { definition, resolved } = active();
    const css = themeCss(resolved, store.getState().density);
    if (css === shownCss) return;
    shownCss = css;
    applyTheme(definition.id, resolved.appearance, css);
    for (const listener of listeners) listener();
  };

  const offStore = store.subscribe(apply);
  const offPoints = points.subscribe(apply);
  os.addEventListener("change", apply);
  apply();

  const api: ThemeApi = {
    store,
    list,
    active,
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  const dispose = () => {
    offStore();
    offPoints();
    os.removeEventListener("change", apply);
    listeners.clear();
  };
  return { api, dispose };
}

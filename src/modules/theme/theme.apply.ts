import type { ThemeAppearance } from "./theme.types";

/** The `<style>` the theme is written into; `index.html` creates it from the cache before paint. */
const STYLE_ID = "cloudy-theme";

/** Must match the key read by the script in `index.html`. */
const CSS_CACHE_KEY = "cloudy-clip.theme-css";

/** The appearance last shown, as the script in `index.html` left it. Dark on a first run. */
export function shownAppearance(): ThemeAppearance {
  return document.documentElement.dataset.appearance === "light" ? "light" : "dark";
}

/** Writes a theme's CSS, marks `<html>` with it and caches it for the next start. */
export function applyTheme(id: string, appearance: ThemeAppearance, css: string): void {
  let style = document.getElementById(STYLE_ID);
  if (!style) {
    style = document.createElement("style");
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }
  if (style.textContent !== css) style.textContent = css;

  const root = document.documentElement;
  root.dataset.theme = id;
  root.dataset.appearance = appearance;
  try {
    localStorage.setItem(CSS_CACHE_KEY, JSON.stringify({ css, appearance }));
  } catch {
    // The cache only avoids a flash on the next start.
  }
}

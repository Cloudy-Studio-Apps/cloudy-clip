import type { FontRef } from "../fonts.types";

/** Fontsource family names of the fonts shipped with the app. */
const BUNDLED_FAMILIES: Record<string, string> = {
  Inter: "Inter Variable",
  "JetBrains Mono": "JetBrains Mono Variable",
};

/** The CSS family name a font is registered under ("Inter" is "Inter Variable"; other sources keep their name). */
export function bundledCssFamily(family: string): string {
  return BUNDLED_FAMILIES[family] ?? family;
}

/** CSS `font-family` list for a font: its quoted, escaped name, then Inter and a generic fallback. */
export function cssFontFamily(font: FontRef): string {
  const name = font.source === "bundled" ? bundledCssFamily(font.family) : font.family;
  const quoted = `"${name.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  return name === "Inter Variable"
    ? `${quoted}, sans-serif`
    : `${quoted}, "Inter Variable", sans-serif`;
}

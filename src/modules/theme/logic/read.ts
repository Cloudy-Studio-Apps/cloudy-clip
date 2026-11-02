import { isThemeToken } from "./tokens";
import type {
  ReadThemeResult,
  ThemeCorners,
  ThemeDensity,
  ThemeFonts,
  ThemeTokens,
} from "../theme.types";

const ID = /^[a-z0-9][a-z0-9-]*$/;
const DENSITIES: readonly ThemeDensity[] = ["compact", "default", "comfortable"];
/** What could end a declaration or the style sheet, or load something: never in a value. */
const UNSAFE_VALUE = /[;{}<>\\]|url\(|@import/i;

const isSafe = (value: unknown): value is string =>
  typeof value === "string" && value.trim() !== "" && !UNSAFE_VALUE.test(value);

/**
 * A theme from a module or a plugin, checked field by field, because its values are written into
 * a style sheet. Unknown tokens are left out and listed in `ignored`. Throws with a message for
 * the theme's author when something required is wrong.
 */
export function readTheme(data: unknown): ReadThemeResult {
  if (typeof data !== "object" || data === null) throw new Error("A theme must be an object.");
  const t = data as Record<string, unknown>;
  if (typeof t.id !== "string" || !ID.test(t.id)) {
    throw new Error("A theme needs an id of lowercase letters, digits and dashes.");
  }
  const where = `The theme "${t.id}"`;
  if (typeof t.label !== "string" || !t.label) throw new Error(`${where} needs a label.`);
  if (t.appearance !== "light" && t.appearance !== "dark") {
    throw new Error(`${where} needs an appearance: "light" or "dark".`);
  }
  if (t.extends !== undefined && typeof t.extends !== "string") {
    throw new Error(`${where}: "extends" must be a theme id.`);
  }
  if (t.density !== undefined && !DENSITIES.includes(t.density as ThemeDensity)) {
    throw new Error(`${where}: "density" must be compact, default or comfortable.`);
  }

  const ignored: string[] = [];
  const tokens = readTokens(t.tokens ?? {}, where, ignored);
  const preview = t.preview as Record<string, unknown> | undefined;
  const previewColor = (key: "background" | "surface" | "primary" | "foreground") => {
    const value = preview?.[key] ?? tokens[key];
    if (!isSafe(value)) throw new Error(`${where} needs preview.${key} (or the matching token).`);
    return value;
  };

  return {
    theme: {
      id: t.id,
      label: t.label,
      appearance: t.appearance,
      ...(typeof t.description === "string" ? { description: t.description } : {}),
      ...(typeof t.family === "string" && t.family.trim() ? { family: t.family.trim() } : {}),
      ...(typeof t.extends === "string" ? { extends: t.extends } : {}),
      ...(typeof t.owner === "string" ? { owner: t.owner } : {}),
      tokens,
      ...(t.fonts ? { fonts: readFonts(t.fonts, where) } : {}),
      ...(t.density ? { density: t.density as ThemeDensity } : {}),
      ...(t.corners ? { corners: readCorners(t.corners, where) } : {}),
      preview: {
        background: previewColor("background"),
        surface: previewColor("surface"),
        primary: previewColor("primary"),
        foreground: previewColor("foreground"),
      },
    },
    ignored,
  };
}

function readTokens(data: unknown, where: string, ignored: string[]): ThemeTokens {
  if (typeof data !== "object" || data === null) {
    throw new Error(`${where}: tokens must be an object.`);
  }
  const tokens: ThemeTokens = {};
  for (const [name, value] of Object.entries(data)) {
    if (!isThemeToken(name)) {
      ignored.push(name);
      continue;
    }
    if (!isSafe(value)) throw new Error(`${where}: the token "${name}" needs a CSS value.`);
    tokens[name] = value;
  }
  return tokens;
}

function readFonts(data: unknown, where: string): ThemeFonts {
  const fonts = data as Record<string, unknown>;
  const result: ThemeFonts = {};
  for (const key of ["sans", "mono", "hand"] as const) {
    const value = fonts[key];
    if (value === undefined) continue;
    if (!isSafe(value)) throw new Error(`${where}: fonts.${key} must be a font stack.`);
    result[key] = value;
  }
  return result;
}

function readCorners(data: unknown, where: string): ThemeCorners {
  const corners = data as Record<string, unknown>;
  const result: ThemeCorners = {};
  for (const key of ["control", "card", "max"] as const) {
    const value = corners[key];
    if (value === undefined) continue;
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error(`${where}: corners.${key} must be a number of px.`);
    }
    result[key] = value;
  }
  return result;
}

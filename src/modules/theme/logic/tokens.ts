/**
 * Every semantic token a theme can set: the CSS custom properties without `--`. Palette scales
 * aren't here: themes give meanings, and may use the scales as values (`var(--seal-900)`).
 */
export const THEME_TOKEN_NAMES = [
  // Surfaces and text
  "background",
  "foreground",
  "surface",
  "surface-sunken",
  "muted",
  "muted-foreground",
  "subtle-foreground",
  "hover",
  "popover",
  "stage",
  "lane",
  // Lines
  "border",
  "border-strong",
  "ring",
  // Roles
  "primary",
  "primary-hover",
  "primary-foreground",
  "primary-soft",
  "primary-soft-foreground",
  "ink-hover",
  "mark",
  "mark-hover",
  "mark-foreground",
  "on",
  "online",
  "accent-soft",
  "accent-soft-foreground",
  "destructive",
  "destructive-soft",
  "destructive-soft-foreground",
  // Clips on the timeline
  "clip-video",
  "clip-audio",
  "clip-type",
  "clip-composition",
  "clip-foreground",
  // Elevation: an `H S% L%` triple the shadows are tinted with.
  "shadow-color",
] as const;

const NAMES: ReadonlySet<string> = new Set(THEME_TOKEN_NAMES);

/** Whether `name` is a token a theme can set. */
export function isThemeToken(name: string): name is (typeof THEME_TOKEN_NAMES)[number] {
  return NAMES.has(name);
}

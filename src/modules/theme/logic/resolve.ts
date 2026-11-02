import type { ResolvedTheme, ThemeDefinition, ThemeFonts, ThemeTokens } from "../theme.types";

/** The theme every chain ends at. Its values are `tokens.css`, so it lists none. */
export const BASE_THEME_ID = "cloudy-dark";

/** The UI stays sharp: no radius past 8px. */
function clampCorner(px: number): number {
  return Math.min(8, Math.max(0, px));
}

/**
 * `theme` with its `extends` chain merged. A chain that loops or names a theme that isn't there
 * stops where it breaks. What no step sets stays as `tokens.css` has it.
 */
export function resolveTheme(
  theme: ThemeDefinition,
  get: (id: string) => ThemeDefinition | undefined,
): ResolvedTheme {
  const chain: ThemeDefinition[] = [];
  const seen = new Set<string>();
  let current: ThemeDefinition | undefined = theme;
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    chain.unshift(current);
    current = current.extends ? get(current.extends) : undefined;
  }

  let tokens: ThemeTokens = {};
  let fonts: ThemeFonts = {};
  let corners = { control: 4, card: 6, max: 8 };
  for (const step of chain) {
    tokens = { ...tokens, ...step.tokens };
    fonts = { ...fonts, ...step.fonts };
    corners = { ...corners, ...step.corners };
  }
  const density = [...chain].reverse().find((step) => step.density)?.density ?? "default";

  return {
    id: theme.id,
    label: theme.label,
    appearance: theme.appearance,
    tokens,
    fonts,
    density,
    corners: {
      control: clampCorner(corners.control),
      card: clampCorner(corners.card),
      max: clampCorner(corners.max),
    },
  };
}

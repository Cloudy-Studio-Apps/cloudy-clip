import type { StoreApi } from "zustand/vanilla";
import type { THEME_TOKEN_NAMES } from "./logic/tokens";

/** The name of a semantic token: a CSS custom property without its `--`. */
export type ThemeTokenName = (typeof THEME_TOKEN_NAMES)[number];

/** Token values by name, as CSS values: a color, or `var(--seal-900)`. */
export type ThemeTokens = Partial<Record<ThemeTokenName, string>>;

/** Whether a theme is light or dark. */
export type ThemeAppearance = "light" | "dark";

/** How tight controls and rows are. */
export type ThemeDensity = "compact" | "default" | "comfortable";

/** Font stacks of the interface. Text clips never use these. */
export interface ThemeFonts {
  /** The interface's font. */
  sans?: string;
  /** Timecodes and numbers. */
  mono?: string;
  /** Titles, tabs and buttons. */
  hand?: string;
}

/** Corner radii in px. Each is clamped to 8: the interface stays sharp. */
export interface ThemeCorners {
  /** Buttons, inputs, chips. */
  control?: number;
  /** Cards, menus, popovers. */
  card?: number;
  /** Dialogs and the largest shapes. */
  max?: number;
}

/** The four colors a theme's card in Settings is drawn with. */
export interface ThemePreview {
  background: string;
  surface: string;
  primary: string;
  foreground: string;
}

/** A theme: what it changes over the one it `extends`, so it lists only what differs. */
export interface ThemeDefinition {
  /** Unique among all themes: lowercase letters, digits and dashes. */
  id: string;
  label: string;
  description?: string;
  /** The name a light and a dark theme share: Settings shows the pair as one card. */
  family?: string;
  appearance: ThemeAppearance;
  /** The theme it starts from. Cloudy Dark when unset. */
  extends?: string;
  tokens: ThemeTokens;
  fonts?: ThemeFonts;
  /** The density it suggests. The user's own choice wins. */
  density?: ThemeDensity;
  corners?: ThemeCorners;
  preview: ThemePreview;
  /** Who added it, for Settings: a plugin's name. The app's themes leave it out. */
  owner?: string;
}

/** A theme with its whole chain merged in. Fonts unset by any step stay unset. */
export interface ResolvedTheme {
  id: string;
  label: string;
  appearance: ThemeAppearance;
  tokens: ThemeTokens;
  fonts: ThemeFonts;
  density: ThemeDensity;
  corners: Required<ThemeCorners>;
}

/** A theme after checking, and the token names it gave that don't exist. */
export interface ReadThemeResult {
  theme: ThemeDefinition;
  ignored: string[];
}

/** One family's themes, one per appearance, from one owner. */
export interface ThemeFamily {
  /** `owner:family`, or `owner:id`: a plugin's family never merges into the app's. */
  key: string;
  /** The family's name when it has both appearances, the theme's label otherwise. */
  label: string;
  /** Unset for the app's own. */
  owner?: string;
  light?: ThemeDefinition;
  dark?: ThemeDefinition;
}

/** Sizes that follow the density, in px. */
export interface DensityMetrics {
  controlHeightSm: number;
  controlHeight: number;
  controlHeightLg: number;
  rowHeight: number;
  controlPadding: number;
  trackHeightVideo: number;
  trackHeightAudio: number;
}

/** One theme always, or one for each appearance of the OS. */
export type ThemeMode = "fixed" | "system";

/** What the user chose. It belongs to the machine, not to a project. */
export interface ThemeChoice {
  mode: ThemeMode;
  /** Shown when `mode` is `fixed`. */
  themeId: string;
  /** Shown when `mode` is `system` and the OS is light. */
  lightThemeId: string;
  /** Shown when `mode` is `system` and the OS is dark. */
  darkThemeId: string;
  /** Overrides the theme's density. Null follows the theme. */
  density: ThemeDensity | null;
}

/** The theme the app shows now. */
export interface ActiveTheme {
  /** What the choice asked for. */
  requestedId: string;
  /** What is shown: the requested theme, or the fallback when it isn't there. */
  definition: ThemeDefinition;
  resolved: ResolvedTheme;
  /** The requested theme isn't there (its plugin is missing or off). */
  missing: boolean;
}

/** The theme module's API. */
export interface ThemeApi {
  /** The user's choice. Read with `useStore`; change it with the `theme.set` command. */
  readonly store: StoreApi<ThemeChoice>;
  /** Every valid theme, built-in ones first. */
  list(): readonly ThemeDefinition[];
  /** The theme shown now. */
  active(): ActiveTheme;
  /** Calls `listener` after the theme shown changes. For drawing that reads tokens. */
  onChange(listener: () => void): () => void;
}

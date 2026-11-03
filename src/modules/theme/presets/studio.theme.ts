import type { ThemeDefinition } from "../theme.types";

/**
 * Neutral grays with Cloudy's blue and red, from the Tint page's Studio prototype
 * (`docs/prototype/designs/tint-d-studio.html`). Built over Cloudy Dark, so it lists only the grays.
 */
export const STUDIO: ThemeDefinition = {
  id: "studio",
  label: "Studio",
  description: "Neutral grays, like a grading suite: nothing tints the picture.",
  appearance: "dark",
  tokens: {
    background: "#161616",
    surface: "#1f1f1f",
    "surface-sunken": "#101010",
    muted: "#272727",
    hover: "#272727",
    popover: "#272727",
    stage: "#101010",
    lane: "#161616",
    border: "#2e2e2e",
    "border-strong": "#3c3c3c",
    foreground: "#e4e4e4",
    "muted-foreground": "#a3a3a3",
    "subtle-foreground": "#6f6f6f",
    "primary-foreground": "#161616",
    "mark-foreground": "#1f1f1f",
    "shadow-color": "0 0% 3%",
  },
  preview: {
    background: "#161616",
    surface: "#1f1f1f",
    primary: "#6fb7e6",
    foreground: "#e4e4e4",
  },
};

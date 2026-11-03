import type { ThemeDefinition } from "../theme.types";

/**
 * Near-black with orange embers and blue sparks. In the style of the doran'vs VS Code theme
 * (Ciro Amato, github.com/DrKGD/darkorange-theme-vscode): its blacks, orange, blue and red, with
 * Molokai's green and purple on the clips.
 */
export const EMBER: ThemeDefinition = {
  id: "ember",
  label: "Ember",
  description: "Near-black with orange embers and blue sparks.",
  appearance: "dark",
  tokens: {
    background: "#080808",
    foreground: "#d4d4d4",
    surface: "#0f0f0f",
    "surface-sunken": "#040404",
    muted: "#1a1a1a",
    "muted-foreground": "#a0a0a0",
    "subtle-foreground": "#c07010",
    hover: "#1f1f1f",
    popover: "#1a1a1a",
    stage: "#010101",
    lane: "#080808",
    dim: "rgb(0 0 0 / 0.5)",
    border: "#242424",
    "border-strong": "#3f3f3f",
    ring: "#179aff",
    primary: "#ff9507",
    "primary-hover": "#ffab3d",
    "primary-foreground": "#060606",
    "primary-soft": "#2a1a05",
    "primary-soft-foreground": "#ffc576",
    "ink-hover": "#ffffff",
    mark: "#ff004d",
    "mark-hover": "#ff3370",
    "mark-foreground": "#060606",
    on: "#179aff",
    online: "#a6e22e",
    "accent-soft": "#062038",
    "accent-soft-foreground": "#66b8ff",
    destructive: "#ff004d",
    "destructive-soft": "#2a0612",
    "destructive-soft-foreground": "#ff7a9c",
    "clip-video": "#0a2d4d",
    "clip-audio": "#22331a",
    "clip-type": "#4a2e08",
    "clip-composition": "#2e2346",
    "clip-foreground": "#e6e6e6",
    "shadow-color": "0 0% 0%",
  },
  preview: {
    background: "#080808",
    surface: "#0f0f0f",
    primary: "#ff9507",
    foreground: "#d4d4d4",
  },
};

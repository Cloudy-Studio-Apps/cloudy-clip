import type { ThemeDefinition } from "../theme.types";

/**
 * Near-black with orange embers and blue sparks. In the style of the doran'vs VS Code theme
 * (Ciro Amato, github.com/DrKGD/darkorange-theme-vscode): its blacks, orange, blue and red, with
 * Molokai's green and purple on the clips. High contrast like the original: near-white text, orange
 * labels and control outlines, amber-tinted separators.
 */
export const EMBER: ThemeDefinition = {
  id: "ember",
  label: "Ember",
  description: "Near-black with orange embers and blue sparks.",
  appearance: "dark",
  tokens: {
    background: "#090909",
    foreground: "#f2f2f2",
    surface: "#141414",
    "surface-sunken": "#030303",
    muted: "#222222",
    "muted-foreground": "#cccccc",
    "subtle-foreground": "#f08a00",
    hover: "#2a2a2a",
    popover: "#161616",
    stage: "#010101",
    lane: "#090909",
    dim: "rgb(0 0 0 / 0.5)",
    border: "#3a2a14",
    "border-strong": "#c46a00",
    ring: "#179aff",
    primary: "#ff9507",
    "primary-hover": "#ffab3d",
    "primary-foreground": "#060606",
    "primary-soft": "#3d2505",
    "primary-soft-foreground": "#ffb347",
    "ink-hover": "#ffffff",
    mark: "#ff004d",
    "mark-hover": "#ff3370",
    "mark-foreground": "#060606",
    on: "#179aff",
    online: "#a6e22e",
    "accent-soft": "#0a2e52",
    "accent-soft-foreground": "#7cc4ff",
    destructive: "#ff004d",
    "destructive-soft": "#3d0819",
    "destructive-soft-foreground": "#ff7a9c",
    "clip-video": "#0e3f6b",
    "clip-audio": "#2e4a1f",
    "clip-type": "#66400a",
    "clip-composition": "#3f2f60",
    "clip-foreground": "#ffffff",
    "shadow-color": "0 0% 0%",
  },
  preview: {
    background: "#090909",
    surface: "#141414",
    primary: "#ff9507",
    foreground: "#f2f2f2",
  },
};

import type { ThemeDefinition } from "../theme.types";
import { BLACK } from "./black.theme";
import { CATPPUCCIN_LATTE } from "./catppuccin-latte.theme";
import { CATPPUCCIN_MOCHA } from "./catppuccin-mocha.theme";
import { CLOUDY_DARK } from "./cloudy-dark.theme";
import { CLOUDY_LIGHT } from "./cloudy-light.theme";
import { DRACULA } from "./dracula.theme";
import { EMBER } from "./ember.theme";
import { GRUVBOX_DARK } from "./gruvbox-dark.theme";
import { HIGH_CONTRAST_DARK } from "./high-contrast-dark.theme";
import { HIGH_CONTRAST_LIGHT } from "./high-contrast-light.theme";
import { JETBRAINS_DARK } from "./jetbrains-dark.theme";
import { JETBRAINS_LIGHT } from "./jetbrains-light.theme";
import { LILAC } from "./lilac.theme";
import { NORD } from "./nord.theme";
import { ORANGE_LIGHT } from "./orange-light.theme";
import { PAPER } from "./paper.theme";
import { ROSE_PINE } from "./rose-pine.theme";
import { ROSE_PINE_DAWN } from "./rose-pine-dawn.theme";
import { SAND } from "./sand.theme";
import { SOLARIZED_DARK } from "./solarized-dark.theme";
import { SOLARIZED_LIGHT } from "./solarized-light.theme";
import { STUDIO } from "./studio.theme";
import { TERMINAL } from "./terminal.theme";

/** The themes the app comes with, in the chooser's order: Cloudy's own first, then the ones from Cloudy Canvas, pairs by family. */
export const BUILT_IN_THEMES: readonly ThemeDefinition[] = [
  CLOUDY_DARK,
  CLOUDY_LIGHT,
  STUDIO,
  EMBER,
  SAND,
  LILAC,
  ORANGE_LIGHT,
  BLACK,
  HIGH_CONTRAST_LIGHT,
  HIGH_CONTRAST_DARK,
  PAPER,
  SOLARIZED_LIGHT,
  SOLARIZED_DARK,
  CATPPUCCIN_LATTE,
  CATPPUCCIN_MOCHA,
  ROSE_PINE_DAWN,
  ROSE_PINE,
  JETBRAINS_LIGHT,
  JETBRAINS_DARK,
  NORD,
  DRACULA,
  GRUVBOX_DARK,
  TERMINAL,
];

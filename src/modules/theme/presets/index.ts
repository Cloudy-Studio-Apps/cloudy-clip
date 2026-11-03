import type { ThemeDefinition } from "../theme.types";
import { CLOUDY_DARK } from "./cloudy-dark.theme";
import { CLOUDY_LIGHT } from "./cloudy-light.theme";
import { STUDIO } from "./studio.theme";

/** The themes the app comes with. */
export const BUILT_IN_THEMES: readonly ThemeDefinition[] = [CLOUDY_DARK, CLOUDY_LIGHT, STUDIO];

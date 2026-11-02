import type { ThemeDefinition } from "../theme.types";

/** Mesa de noche, the app's own look. Its values are `tokens.css`, so it lists none. */
export const CLOUDY_DARK: ThemeDefinition = {
  id: "cloudy-dark",
  label: "Cloudy Dark",
  description: "The animator's desk at night: black paper, blue roughs.",
  appearance: "dark",
  tokens: {},
  preview: {
    background: "#14171b",
    surface: "#202327",
    primary: "#6fb7e6",
    foreground: "#eceff1",
  },
};

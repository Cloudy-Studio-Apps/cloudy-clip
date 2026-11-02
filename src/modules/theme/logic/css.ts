import { DENSITY_METRICS } from "./density";
import type { ResolvedTheme, ThemeDensity } from "../theme.types";

/**
 * The CSS that applies `theme`, written as `html:root` so it wins over `tokens.css` whatever order
 * the sheets load in. `density` overrides the theme's own.
 */
export function themeCss(theme: ResolvedTheme, density?: ThemeDensity | null): string {
  const metrics = DENSITY_METRICS[density ?? theme.density];
  const { control, card, max } = theme.corners;
  const { fonts } = theme;
  const vars: Record<string, string> = {
    ...Object.fromEntries(
      Object.entries(theme.tokens).map(([name, value]) => [`--${name}`, value]),
    ),
    "--radius-xs": `${control / 2}px`,
    "--radius-sm": `${control}px`,
    "--radius-md": `${card}px`,
    "--radius-lg": `${max}px`,
    "--control-h-sm": `${metrics.controlHeightSm}px`,
    "--control-h": `${metrics.controlHeight}px`,
    "--control-h-lg": `${metrics.controlHeightLg}px`,
    "--control-px": `${metrics.controlPadding}px`,
    "--row-h": `${metrics.rowHeight}px`,
    "--track-h-video": `${metrics.trackHeightVideo}px`,
    "--track-h-audio": `${metrics.trackHeightAudio}px`,
    ...(fonts.sans ? { "--font-sans": fonts.sans } : {}),
    ...(fonts.mono ? { "--font-mono": fonts.mono } : {}),
    ...(fonts.hand ? { "--font-hand": fonts.hand } : {}),
  };
  const declarations = Object.entries(vars)
    .map(([name, value]) => `  ${name}: ${value};\n`)
    .join("");
  return `html:root {\n${declarations}  color-scheme: ${theme.appearance};\n}`;
}

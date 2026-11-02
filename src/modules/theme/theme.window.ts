import { getCurrentWindow } from "@tauri-apps/api/window";
import type { Logger } from "@/core";
import type { ThemeAppearance } from "./theme.types";

/**
 * Sets the appearance of the OS title bar. `null` hands it back to the OS, which `system` mode
 * needs: a set theme also changes what `prefers-color-scheme` reports, so a set one would hide
 * the OS's changes.
 */
export function setWindowAppearance(appearance: ThemeAppearance | null, log: Logger): void {
  getCurrentWindow()
    .setTheme(appearance)
    .catch((error: unknown) => log.warn("The title bar could not follow the theme", error));
}

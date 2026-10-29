import { CaseUpper, Italic, RotateCcw, type LucideIcon } from "lucide-react";

/** Icons controls may name (`icon: "Italic"`); a short list so the bundle keeps only these. */
const ICONS: Readonly<Record<string, LucideIcon>> = { CaseUpper, Italic, RotateCcw };

/** The icon with this name, or undefined. */
export function controlIcon(name: string | undefined): LucideIcon | undefined {
  return name ? ICONS[name] : undefined;
}

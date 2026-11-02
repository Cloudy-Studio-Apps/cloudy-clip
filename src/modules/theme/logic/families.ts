import type { ThemeDefinition, ThemeFamily } from "../theme.types";

/**
 * The themes as families, in order: a light and a dark theme with the same owner and `family`
 * share one. A theme without a family, or whose appearance its family already has, is its own.
 */
export function groupFamilies(themes: readonly ThemeDefinition[]): ThemeFamily[] {
  const families = new Map<string, ThemeFamily>();
  for (const theme of themes) {
    const owner = theme.owner ?? "app";
    const familyKey = `${owner}:${theme.family ?? theme.id}`;
    const existing = families.get(familyKey);
    const key = existing?.[theme.appearance] ? `${owner}:${theme.id}` : familyKey;
    const family: ThemeFamily = families.get(key) ?? {
      key,
      label: theme.label,
      ...(theme.owner ? { owner: theme.owner } : {}),
    };
    family[theme.appearance] = theme;
    if (family.light && family.dark) family.label = theme.family ?? theme.label;
    families.set(key, family);
  }
  return [...families.values()];
}

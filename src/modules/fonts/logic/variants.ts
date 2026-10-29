import type { FontWeight } from "@/modules/project";
import type { FontFamily, FontRequest, FontVariant } from "../fonts.types";

/** The nearest CSS weight to any number (fonts report 350, 450, ...). */
export function nearestWeight(n: number): FontWeight {
  const rounded = Math.min(900, Math.max(100, Math.round(n / 100) * 100));
  return String(rounded) as FontWeight;
}

/** Faces sorted by style (upright first), then weight; duplicates dropped. */
export function sortVariants(v: readonly FontVariant[]): FontVariant[] {
  const seen = new Set<string>();
  return v
    .filter((variant) => {
      const key = `${variant.weight}${variant.style}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) =>
      a.style === b.style ? Number(a.weight) - Number(b.weight) : a.style === "normal" ? -1 : 1,
    );
}

/** The face of `family` closest to `want`: same style first, then the nearest weight. */
export function closestVariant(family: FontFamily, want: FontVariant): FontVariant {
  const distance = (variant: FontVariant) =>
    (variant.style === want.style ? 0 : 1000) +
    Math.abs(Number(variant.weight) - Number(want.weight));
  return [...family.variants].sort((a, b) => distance(a) - distance(b))[0] ?? want;
}

/** The key of a face (`family|weight|style`), e.g. for caches. */
export function fontKey(r: FontRequest): string {
  return `${r.family}|${r.weight}|${r.style}`;
}

/**
 * Joins the three sources. Bundled wins over installed and Google; installed wins over Google.
 * Order: bundled, installed (alphabetical), Google.
 */
export function mergeFamilies(
  bundled: readonly FontFamily[],
  installed: readonly FontFamily[],
  google: readonly FontFamily[],
): FontFamily[] {
  const bundledNames = new Set(bundled.map((f) => f.family));
  const inst = installed
    .filter((f) => !bundledNames.has(f.family))
    .sort((a, b) => a.family.localeCompare(b.family));
  const taken = new Set([...bundledNames, ...inst.map((f) => f.family)]);
  return [...bundled, ...inst, ...google.filter((f) => !taken.has(f.family))];
}

/** Case-insensitive substring match on the family name; prefix matches come first. */
export function searchFamilies(
  families: readonly FontFamily[],
  query: string,
  limit: number,
): FontFamily[] {
  const q = query.trim().toLowerCase();
  if (!q) return families.slice(0, limit);
  const prefix: FontFamily[] = [];
  const inner: FontFamily[] = [];
  for (const f of families) {
    const name = f.family.toLowerCase();
    if (name.startsWith(q)) prefix.push(f);
    else if (name.includes(q)) inner.push(f);
  }
  return [...prefix, ...inner].slice(0, limit);
}

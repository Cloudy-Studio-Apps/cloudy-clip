import type { FontWeight } from "@/modules/project";
import type { FontFaceSource, FontFamily, FontVariant } from "../fonts.types";
import { sortVariants } from "./variants";

/** Google's list of every family (unofficial, used by fonts.google.com; no API key). */
export const GOOGLE_CATALOG_URL = "https://fonts.google.com/metadata/fonts";

/** Parses the catalog JSON, which Google prefixes with `)]}'` against JSON hijacking. */
export function parseGoogleCatalog(text: string): FontFamily[] {
  const json = JSON.parse(text.replace(/^\)\]\}'\s*/, "")) as {
    familyMetadataList?: {
      family?: unknown;
      category?: unknown;
      fonts?: Record<string, unknown>;
    }[];
  };
  const families: FontFamily[] = [];
  for (const item of json.familyMetadataList ?? []) {
    if (typeof item.family !== "string") continue;
    const variants: FontVariant[] = [];
    for (const key of Object.keys(item.fonts ?? {})) {
      const match = /^([1-9]00)(i?)$/.exec(key);
      if (match) {
        variants.push({
          weight: match[1] as FontWeight,
          style: match[2] ? "italic" : "normal",
        });
      }
    }
    if (variants.length === 0) continue;
    families.push({
      family: item.family,
      source: "google",
      category: typeof item.category === "string" ? item.category.toLowerCase() : undefined,
      variants: sortVariants(variants),
    });
  }
  return families;
}

/** The CSS (API v2) that describes one face of a Google family. */
export function googleFontCssUrl(family: string, { weight, style }: FontVariant): string {
  const name = encodeURIComponent(family).replace(/%20/g, "+");
  return `https://fonts.googleapis.com/css2?family=${name}:ital,wght@${style === "italic" ? 1 : 0},${weight}`;
}

/** The face files Google's CSS lists (one per script subset, or one for the whole face). */
export function parseFontFaceCss(css: string): FontFaceSource[] {
  const sources: FontFaceSource[] = [];
  for (const block of css.match(/@font-face\s*\{[^}]*\}/g) ?? []) {
    const url = /url\(([^)]+)\)/.exec(block)?.[1]?.replace(/["']/g, "");
    if (!url) continue;
    const range = /unicode-range:\s*([^;]+);/.exec(block)?.[1]?.trim();
    sources.push(range ? { url, unicodeRange: range } : { url });
  }
  return sources;
}

const WEIGHTS: readonly FontWeight[] = [
  "100",
  "200",
  "300",
  "400",
  "500",
  "600",
  "700",
  "800",
  "900",
];

/** Popular families offered when the catalog can't be read (offline, first run). */
export const GOOGLE_FALLBACK_FAMILIES: readonly FontFamily[] = [
  "Roboto",
  "Open Sans",
  "Lato",
  "Montserrat",
  "Poppins",
  "Inter",
  "Raleway",
  "Nunito",
  "Playfair Display",
  "Merriweather",
  "Source Sans 3",
  "Oswald",
  "Work Sans",
  "DM Sans",
  "Space Grotesk",
  "JetBrains Mono",
].map((family) => ({
  family,
  source: "google" as const,
  variants: sortVariants(
    (["400", "500", "600", "700"] as const).flatMap((weight) => [
      { weight, style: "normal" as const },
      { weight, style: "italic" as const },
    ]),
  ),
}));

/** Families shipped with the app (Fontsource): Inter and JetBrains Mono, 100-900, upright and italic. */
export const BUNDLED_FAMILIES: readonly FontFamily[] = ["Inter", "JetBrains Mono"].map(
  (family) => ({
    family,
    source: "bundled" as const,
    variants: sortVariants(
      WEIGHTS.flatMap((weight) => [
        { weight, style: "normal" as const },
        { weight, style: "italic" as const },
      ]),
    ),
  }),
);

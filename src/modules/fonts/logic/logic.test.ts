import { describe, expect, it } from "vitest";
import type { FontFamily } from "../fonts.types";
import {
  GOOGLE_FALLBACK_FAMILIES,
  googleFontCssUrl,
  parseFontFaceCss,
  parseGoogleCatalog,
} from "./catalog";
import {
  closestVariant,
  fontKey,
  mergeFamilies,
  nearestWeight,
  searchFamilies,
  sortVariants,
} from "./variants";

const fam = (family: string, source: FontFamily["source"]): FontFamily => ({
  family,
  source,
  variants: [{ weight: "400", style: "normal" }],
});

describe("catalog", () => {
  it("strips the prefix, maps variants and skips empty families", () => {
    const text = `)]}'\n${JSON.stringify({
      familyMetadataList: [
        { family: "Roboto", category: "Sans Serif", fonts: { "400": {}, "700i": {} } },
        { family: "Empty", fonts: {} },
      ],
    })}`;
    const out = parseGoogleCatalog(text);
    expect(out).toHaveLength(1);
    expect(out[0]?.variants).toEqual([
      { weight: "400", style: "normal" },
      { weight: "700", style: "italic" },
    ]);
    expect(out[0]?.source).toBe("google");
  });

  it("parses two font-face blocks with unicode ranges", () => {
    const css = `@font-face { src: url(https://x/a.woff2) format('woff2'); unicode-range: U+0000-00FF; }
@font-face { src: url("https://x/b.woff2"); unicode-range: U+0100-024F; }`;
    expect(parseFontFaceCss(css)).toEqual([
      { url: "https://x/a.woff2", unicodeRange: "U+0000-00FF" },
      { url: "https://x/b.woff2", unicodeRange: "U+0100-024F" },
    ]);
  });

  it("builds the CSS url", () => {
    expect(googleFontCssUrl("Source Sans 3", { weight: "700", style: "italic" })).toContain(
      "family=Source+Sans+3:ital,wght@1,700",
    );
  });

  it("has 16 fallback families", () => {
    expect(GOOGLE_FALLBACK_FAMILIES).toHaveLength(16);
  });
});

describe("variants", () => {
  it("rounds weights", () => {
    expect(nearestWeight(650)).toBe("700");
    expect(nearestWeight(40)).toBe("100");
  });

  it("sorts upright first and drops duplicates", () => {
    expect(
      sortVariants([
        { weight: "400", style: "italic" },
        { weight: "700", style: "normal" },
        { weight: "700", style: "normal" },
      ]),
    ).toEqual([
      { weight: "700", style: "normal" },
      { weight: "400", style: "italic" },
    ]);
  });

  it("prefers the same style, then the nearest weight", () => {
    const family: FontFamily = {
      family: "X",
      source: "google",
      variants: [
        { weight: "400", style: "normal" },
        { weight: "800", style: "normal" },
        { weight: "700", style: "italic" },
      ],
    };
    expect(closestVariant(family, { weight: "700", style: "normal" })).toEqual({
      weight: "800",
      style: "normal",
    });
    expect(closestVariant(family, { weight: "400", style: "italic" })).toEqual({
      weight: "700",
      style: "italic",
    });
  });

  it("keys a request", () => {
    expect(fontKey({ family: "A", source: "google", weight: "400", style: "normal" })).toBe(
      "A|400|normal",
    );
  });

  it("merges with bundled > installed > google", () => {
    const merged = mergeFamilies(
      [fam("Inter", "bundled")],
      [fam("Inter", "installed"), fam("Roboto", "installed"), fam("Arial", "installed")],
      [fam("Inter", "google"), fam("Roboto", "google"), fam("Lato", "google")],
    );
    expect(merged.map((f) => `${f.family}:${f.source}`)).toEqual([
      "Inter:bundled",
      "Arial:installed",
      "Roboto:installed",
      "Lato:google",
    ]);
  });

  it("searches with prefix matches first", () => {
    const list = [fam("Fira Robust", "google"), fam("Roboto", "google"), fam("Lato", "google")];
    expect(searchFamilies(list, "rob", 5).map((f) => f.family)).toEqual(["Roboto", "Fira Robust"]);
    expect(searchFamilies(list, "", 2)).toHaveLength(2);
  });
});

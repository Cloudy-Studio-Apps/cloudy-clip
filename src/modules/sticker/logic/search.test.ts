import { describe, expect, it } from "vitest";
import type { StickerHit } from "../sticker.types";
import { searchStickers } from "./search";

const hit = (pack: string, id: string, keywords: string[], topics: string[] = []): StickerHit => ({
  pack,
  sticker: { id, label: id, keywords, topics, art: () => ({ type: "image", url: "" }) },
});

const all = [
  hit("emoji", "Red Heart", ["love"], ["smileys"]),
  hit("emoji", "Grin", ["happy"], ["smileys"]),
  hit("seal", "Love", ["cute"], ["reactions"]),
];
const ids = (hits: StickerHit[]) => hits.map((h) => h.sticker.id);

describe("searchStickers", () => {
  it("matches label and keywords, case-insensitively", () => {
    expect(ids(searchStickers(all, { text: "LOVE" }))).toEqual(["Red Heart", "Love"]);
  });

  it("filters by topic and by pack", () => {
    expect(ids(searchStickers(all, { topic: "smileys" }))).toEqual(["Red Heart", "Grin"]);
    expect(ids(searchStickers(all, { pack: "seal" }))).toEqual(["Love"]);
  });

  it("respects limit", () => {
    expect(searchStickers(all, { limit: 1 })).toHaveLength(1);
  });

  it("returns nothing for no match", () => {
    expect(searchStickers(all, { text: "zzzz" })).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import type {
  StickerDefinition,
  StickerPackDefinition,
  StickerStyleDefinition,
} from "../sticker.types";
import { mergeAxes, resolveArt } from "./art";

const sticker: StickerDefinition = {
  id: "heart",
  label: "Heart",
  variations: ["style"],
  art: (v) => ({ type: "image", url: `own:${v.style}` }),
};

const pack: StickerPackDefinition = {
  id: "emoji",
  name: "Emoji",
  order: 1,
  variations: [
    { id: "style", label: "Style", options: [{ id: "flat", label: "Flat" }], default: "flat" },
    { id: "tone", label: "Tone", options: [{ id: "light", label: "Light" }], default: "light" },
  ],
  stickers: [sticker],
};

const color: StickerStyleDefinition = {
  pack: "emoji",
  axis: "style",
  option: { id: "color", label: "Color" },
  art: (s) => ({ type: "image", url: `style:${s.id}` }),
};

describe("mergeAxes", () => {
  it("adds a style's option to the pack's axis", () => {
    const [axis] = mergeAxes(pack, [color], sticker);
    expect(axis?.options.map((o) => o.id)).toEqual(["flat", "color"]);
  });

  it("leaves out a style of another pack", () => {
    const [axis] = mergeAxes(pack, [{ ...color, pack: "other" }], sticker);
    expect(axis?.options.map((o) => o.id)).toEqual(["flat"]);
  });

  it("returns only the axes the sticker uses", () => {
    expect(mergeAxes(pack, [], sticker).map((a) => a.id)).toEqual(["style"]);
  });
});

describe("resolveArt", () => {
  it("uses the sticker's art for its own options", () => {
    expect(resolveArt(pack, [color], sticker, { style: "flat" }).url).toBe("own:flat");
  });

  it("uses the style's art for a style's option", () => {
    expect(resolveArt(pack, [color], sticker, { style: "color" }).url).toBe("style:heart");
  });

  it("falls back to the axis default when the option's style was removed", () => {
    expect(resolveArt(pack, [], sticker, { style: "color" }).url).toBe("own:flat");
  });

  it("fills in defaults for axes the variation doesn't name", () => {
    expect(resolveArt(pack, [color], sticker, {}).url).toBe("own:flat");
  });
});

import { svgDataUrl } from "../../logic/svg";
import { defineStickerPack } from "../../sticker.points";
import type { EditingShape, StickerAxis, StickerDefinition } from "../../sticker.types";
import { EDITING_SHAPES } from "./editing.art";

/** The Color axis: enough to read on any footage. */
const COLOR: StickerAxis = {
  id: "color",
  label: "Color",
  default: "white",
  options: [
    { id: "white", label: "White", swatch: "#ffffff" },
    { id: "black", label: "Black", swatch: "#111111" },
    { id: "red", label: "Red", swatch: "#e5484d" },
    { id: "yellow", label: "Yellow", swatch: "#ffd60a" },
    { id: "blue", label: "Blue", swatch: "#2f8fff" },
    { id: "green", label: "Green", swatch: "#30c46c" },
  ],
};

/** The SVG of a shape in one color, outlined in white when black so it shows on dark footage. */
function shapeUrl(shape: EditingShape, swatch: string): string {
  const height = shape.height ?? 128;
  const outline = swatch === "#111111" ? "#ffffff" : "#111111";
  return svgDataUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 ${height}" width="512" height="${height * 4}" ` +
      `stroke-linecap="round" stroke-linejoin="round">${shape.draw(swatch, outline)}</svg>`,
  );
}

function sticker(shape: EditingShape): StickerDefinition {
  const urls = new Map(COLOR.options.map((o) => [o.id, shapeUrl(shape, o.swatch ?? "#ffffff")]));
  return {
    id: shape.id,
    label: shape.label,
    keywords: shape.keywords,
    topics: [shape.topic],
    aspect: 128 / (shape.height ?? 128),
    variations: [COLOR.id],
    art: (variation) => ({ type: "image", url: urls.get(variation.color ?? "") ?? "" }),
  };
}

/** Editing: arrows, marks and empty bubbles for pointing things out on video. */
export const editingPack = defineStickerPack({
  id: "editing",
  name: "Editing",
  order: 20,
  variations: [COLOR],
  stickers: EDITING_SHAPES.map(sticker),
});

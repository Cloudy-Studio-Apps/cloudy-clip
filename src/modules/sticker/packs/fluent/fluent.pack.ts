import { defineStickerPack } from "../../sticker.points";
import type { StickerDefinition } from "../../sticker.types";

const ART = import.meta.glob<string>("./art/*.svg", {
  eager: true,
  query: "?url",
  import: "default",
});

/** The list, loaded on first use so it stays out of the main bundle. */
async function loadStickers(): Promise<readonly StickerDefinition[]> {
  const { default: list } = await import("./fluent.list.json");
  return list.map(({ id, label, keywords }) => {
    const url = ART[`./art/${id}.svg`] ?? "";
    return {
      id,
      label,
      keywords,
      topics: ["smileys"],
      variations: ["style"],
      thumbnail: url,
      art: () => ({ type: "image", url }),
    };
  });
}

/**
 * Fluent Emoji, in the Flat style. `style` has one option today; a plugin adds Color or 3D to it
 * with `stickerStyles`, and the choice then shows on every sticker of this pack.
 */
export const fluentPack = defineStickerPack({
  id: "fluent",
  name: "Fluent Emoji",
  order: 30,
  credit: "Fluent Emoji © Microsoft, MIT",
  variations: [
    { id: "style", label: "Style", options: [{ id: "flat", label: "Flat" }], default: "flat" },
  ],
  stickers: loadStickers,
});

import { definePoint } from "@/core";
import type { StickerPackDefinition, StickerStyleDefinition, StickerTopic } from "./sticker.types";

/** Every sticker pack (built-in and a plugin's). Keyed by `id`. */
export const stickerPacks = definePoint<StickerPackDefinition>("sticker.packs", {
  keyOf: (pack) => pack.id,
});

/** Options added to an axis of a pack another module owns. Keyed by pack, axis and option. */
export const stickerStyles = definePoint<StickerStyleDefinition>("sticker.styles", {
  keyOf: (style) => `${style.pack}:${style.axis}:${style.option.id}`,
});

/** Declares a sticker pack; contribute it to `stickerPacks`. */
export function defineStickerPack(def: StickerPackDefinition): StickerPackDefinition {
  return def;
}

/** Declares a style for an existing pack; contribute it to `stickerStyles`. */
export function defineStickerStyle(def: StickerStyleDefinition): StickerStyleDefinition {
  return def;
}

/** The built-in topics. A pack tags stickers with these ids, or declares its own. */
export const STICKER_TOPICS: readonly StickerTopic[] = [
  { id: "smileys", label: "Smileys" },
  { id: "reactions", label: "Reactions" },
  { id: "arrows", label: "Arrows" },
  { id: "marks", label: "Marks" },
  { id: "bubbles", label: "Bubbles" },
];

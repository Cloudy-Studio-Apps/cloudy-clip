import type {
  StickerArt,
  StickerAxis,
  StickerDefinition,
  StickerPackDefinition,
  StickerStyleDefinition,
  StickerVariation,
} from "../sticker.types";

/** The axes `sticker` uses, each with the options styles add to it. */
export function mergeAxes(
  pack: StickerPackDefinition,
  styles: readonly StickerStyleDefinition[],
  sticker: StickerDefinition,
): StickerAxis[] {
  const used = sticker.variations ?? [];
  return (pack.variations ?? [])
    .filter((axis) => used.includes(axis.id))
    .map((axis) => ({
      ...axis,
      options: [
        ...axis.options,
        ...styles.filter((s) => s.pack === pack.id && s.axis === axis.id).map((s) => s.option),
      ],
    }));
}

/**
 * The picture for a variation: every axis gets its chosen option, or its default when the option
 * isn't there (its plugin was removed). The art comes from the style that owns an option, else
 * from the sticker.
 */
export function resolveArt(
  pack: StickerPackDefinition,
  styles: readonly StickerStyleDefinition[],
  sticker: StickerDefinition,
  variation: StickerVariation,
): StickerArt {
  const filled: StickerVariation = {};
  for (const axis of mergeAxes(pack, styles, sticker)) {
    const chosen = variation[axis.id];
    filled[axis.id] = axis.options.some((o) => o.id === chosen) ? chosen! : axis.default;
  }
  const style = styles.find((s) => s.pack === pack.id && filled[s.axis] === s.option.id);
  return style ? style.art(sticker, filled) : sticker.art(filled);
}

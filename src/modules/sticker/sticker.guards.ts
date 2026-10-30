import { CommandFailure } from "@/core";
import type { StickerAxis, StickerVariation } from "./sticker.types";

/** Refuses an axis the sticker doesn't have, or an option its axis doesn't offer. */
export function checkVariation(axes: readonly StickerAxis[], variation: StickerVariation): void {
  for (const [id, option] of Object.entries(variation)) {
    const axis = axes.find((candidate) => candidate.id === id);
    if (!axis?.options.some((o) => o.id === option)) {
      throw new CommandFailure(
        "sticker.invalid_variation",
        `This sticker has no "${option}" for "${id}". List its variations with sticker_search.`,
      );
    }
  }
}

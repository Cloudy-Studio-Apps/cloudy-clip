import { defineModule } from "@/core";
import { createStickerLibrary } from "./sticker.library";
import { stickerRef } from "./sticker.ref";
import { createStickerRecents } from "./sticker.store";

/** Stickers: packs from the `stickerPacks` point, styles from `stickerStyles`. */
export const stickerModule = defineModule({
  ref: stickerRef,
  name: "Stickers",
  tier: "feature",
  requires: ["project", "element", "preview", "timeline", "transform", "inspector"],
  commands: [],
  mcpTools: [],
  setup({ points, log }) {
    const library = createStickerLibrary(points, log);
    const recents = createStickerRecents();
    return { api: { ...library, recents } };
  },
});

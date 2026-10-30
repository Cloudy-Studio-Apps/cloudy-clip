import { defineModule } from "@/core";
import { elements, propTypes } from "@/modules/element";
import { previewRef } from "@/modules/preview";
import { editingPack } from "./packs/editing/editing.pack";
import { fluentPack } from "./packs/fluent/fluent.pack";
import { sealPack } from "./packs/seal/seal.pack";
import { createStickerArtCache } from "./sticker.art";
import { stickerCommands } from "./sticker.commands";
import { createStickerElement } from "./sticker.element";
import { createStickerLibrary } from "./sticker.library";
import { stickerMcpTools } from "./sticker.mcp";
import { stickerVariationType } from "./sticker.options";
import { stickerPacks } from "./sticker.points";
import { stickerRef } from "./sticker.ref";
import { createStickerRecents } from "./sticker.store";

/** Stickers: packs from the `stickerPacks` point, styles from `stickerStyles`. */
export const stickerModule = defineModule({
  ref: stickerRef,
  name: "Stickers",
  tier: "feature",
  requires: ["project", "element", "preview", "timeline", "transform", "inspector"],
  commands: stickerCommands,
  mcpTools: stickerMcpTools,
  setup({ contribute, log, onDispose, points, require }) {
    const preview = require(previewRef);
    const library = createStickerLibrary(points, log);
    const recents = createStickerRecents();
    const art = createStickerArtCache({ onReady: () => preview.redraw() });
    onDispose(() => art.dispose());
    onDispose(library.onLoaded(() => preview.redraw()));
    contribute(propTypes, stickerVariationType);
    contribute(elements, createStickerElement(library, art));
    contribute(stickerPacks, sealPack, editingPack, fluentPack);
    return { api: { ...library, recents } };
  },
});

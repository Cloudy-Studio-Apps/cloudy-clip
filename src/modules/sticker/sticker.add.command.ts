import { z } from "zod";
import { CommandFailure, defineCommand } from "@/core";
import { addElement } from "@/modules/timeline";
import { checkVariation } from "./sticker.guards";
import { stickerRef } from "./sticker.ref";

/** Puts a sticker on the timeline. */
export const addSticker = defineCommand({
  id: "sticker.add",
  label: "Add sticker",
  description:
    "Adds a sticker to the timeline. pack and sticker are ids from sticker_search; variation picks an option per axis (optional, each axis uses its default). Optional: start (microseconds, defaults to your playhead), duration (microseconds, default 3 s), trackId. Move or scale it with the transform tools; change a variation with element_set_props. Fails when the pack, the sticker or the variation doesn't exist. Returns the new clip.",
  undoable: true,
  input: z.object({
    pack: z.string(),
    sticker: z.string(),
    variation: z.record(z.string(), z.string()).optional(),
    start: z.number().int().min(0).optional().describe("Microseconds"),
    duration: z.number().int().positive().optional().describe("Microseconds"),
    trackId: z.string().optional(),
  }),
  async run(ctx, { pack, sticker, variation = {}, ...placement }) {
    const stickers = ctx.require(stickerRef);
    if (!stickers.packs().some((candidate) => candidate.id === pack)) {
      throw new CommandFailure("sticker.unknown_pack", `No sticker pack "${pack}".`);
    }
    await stickers.load(pack);
    if (!stickers.find(pack, sticker)) {
      throw new CommandFailure(
        "sticker.unknown_sticker",
        `Pack "${pack}" has no sticker "${sticker}".`,
      );
    }
    checkVariation(stickers.axes(pack, sticker), variation);
    return ctx.execute(addElement, {
      kind: "sticker",
      props: { pack, sticker, variation },
      ...placement,
    });
  },
});

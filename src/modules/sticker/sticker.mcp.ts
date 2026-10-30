import { z } from "zod";
import { commandTool, defineMcpTool, textResult } from "@/core";
import { addSticker } from "./sticker.commands";
import { stickerRef } from "./sticker.ref";

/** Lists the packs and topics, so an agent knows what `sticker_search` can filter by. */
const listPacks = defineMcpTool({
  name: "sticker_list_packs",
  readOnly: true,
  description:
    "Lists every sticker pack (id, name, how many stickers, credit) and every topic (id, label). Use them to filter sticker_search.",
  input: z.object({}),
  async handler(_input, ctx) {
    const stickers = ctx.require(stickerRef);
    const packs = await Promise.all(
      stickers.packs().map(async (pack) => ({
        id: pack.id,
        name: pack.name,
        count: (await stickers.load(pack.id)).length,
        credit: pack.credit,
      })),
    );
    return textResult({ packs, topics: stickers.topics() });
  },
});

/** Finds stickers and the variations `sticker_add` accepts. */
const search = defineMcpTool({
  name: "sticker_search",
  readOnly: true,
  description:
    "Finds stickers across every pack by text (labels and keywords), topic or pack. Returns pack, sticker, label, whether it is animated, and its variations (each axis with its options and default). Pass them to sticker_add. Returns 50 at most unless limit says otherwise.",
  input: z.object({
    text: z.string().optional(),
    topic: z.string().optional(),
    pack: z.string().optional(),
    limit: z.number().int().positive().optional(),
  }),
  async handler({ limit = 50, ...query }, ctx) {
    const stickers = ctx.require(stickerRef);
    const hits = await stickers.search({ ...query, limit });
    return textResult(
      hits.map(({ pack, sticker }) => ({
        pack,
        sticker: sticker.id,
        label: sticker.label,
        animated: stickers.artOf(pack, sticker.id, {})?.type === "lottie",
        variations: stickers.axes(pack, sticker.id).map((axis) => ({
          id: axis.id,
          default: axis.default,
          options: axis.options.map((option) => option.id),
        })),
      })),
    );
  },
});

/** Agents add stickers with the same command as the Stickers tab, and find them with these. */
export const stickerMcpTools = [
  commandTool(addSticker, { name: "sticker_add" }),
  listPacks,
  search,
];

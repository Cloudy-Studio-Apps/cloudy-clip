import { notify, type Logger, type PointReader } from "@/core";
import { mergeAxes, resolveArt } from "./logic/art";
import { searchStickers } from "./logic/search";
import { STICKER_TOPICS, stickerPacks, stickerStyles } from "./sticker.points";
import type { StickerDefinition, StickerLibrary, StickerPackDefinition } from "./sticker.types";

/** The catalog of one kernel. Lists stay loaded for the life of the kernel. */
export function createStickerLibrary(points: PointReader, log: Logger): StickerLibrary {
  const loaded = new Map<string, readonly StickerDefinition[]>();
  const loading = new Map<string, Promise<readonly StickerDefinition[]>>();
  const listeners = new Set<() => void>();

  const packOf = (id: string) => points.find(stickerPacks, id);
  const stickersOf = (id: string) => loaded.get(id) ?? [];
  const find = (pack: string, sticker: string) =>
    stickersOf(pack).find((candidate) => candidate.id === sticker);

  function packs(): StickerPackDefinition[] {
    return [...points.get(stickerPacks)].sort((a, b) => a.order - b.order);
  }

  function settle(pack: string, stickers: readonly StickerDefinition[]) {
    loaded.set(pack, stickers);
    for (const listener of listeners) listener();
    return stickers;
  }

  function load(id: string): Promise<readonly StickerDefinition[]> {
    const ready = loaded.get(id);
    if (ready) return Promise.resolve(ready);
    const pending = loading.get(id);
    if (pending) return pending;
    const pack = packOf(id);
    if (!pack) return Promise.resolve([]);
    const { stickers } = pack;
    if (typeof stickers !== "function") return Promise.resolve(settle(id, stickers));

    const run = stickers()
      .then((list) => settle(id, list))
      .catch((error: unknown) => {
        // Not kept, so the next look tries again.
        log.error(`Sticker pack "${id}" failed to load`, error);
        notify("error", `The ${pack.name} stickers failed to load.`);
        return [] as readonly StickerDefinition[];
      })
      .finally(() => loading.delete(id));
    loading.set(id, run);
    return run;
  }

  return {
    packs,
    topics() {
      const topics = new Map(STICKER_TOPICS.map((topic) => [topic.id, topic]));
      for (const pack of packs()) {
        for (const topic of pack.topics ?? [])
          if (!topics.has(topic.id)) topics.set(topic.id, topic);
      }
      return [...topics.values()];
    },
    load,
    isLoaded: (pack) => loaded.has(pack),
    find,
    axes(pack, sticker) {
      const definition = packOf(pack);
      const found = find(pack, sticker);
      if (!definition || !found) return [];
      return mergeAxes(definition, points.get(stickerStyles), found);
    },
    artOf(pack, sticker, variation) {
      const definition = packOf(pack);
      const found = find(pack, sticker);
      if (!definition || !found) return undefined;
      return resolveArt(definition, points.get(stickerStyles), found, variation);
    },
    async search(query) {
      const wanted = packs().filter((pack) => !query.pack || pack.id === query.pack);
      const lists = await Promise.all(wanted.map((pack) => load(pack.id)));
      const hits = lists.flatMap((stickers, i) =>
        stickers.map((sticker) => ({ pack: wanted[i]!.id, sticker })),
      );
      return searchStickers(hits, query);
    },
    onLoaded(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

import { createLottiePlayer } from "./sticker.lottie";
import type { LottiePlayer, StickerArt, StickerArtCache } from "./sticker.types";

/** Rasters kept at once; the oldest goes first and is made again if it shows again. */
const MAX_RASTERS = 64;

interface ImageEntry {
  image: HTMLImageElement;
  state: "loading" | "ready" | "failed";
  raster: HTMLCanvasElement | null;
}

interface LottieEntry {
  player: LottiePlayer | null;
  state: "loading" | "ready" | "failed";
}

/** The smallest power of two at least `width`, so resizing a clip doesn't raster every step. */
function rasterWidthFor(width: number): number {
  return 2 ** Math.ceil(Math.log2(Math.max(1, width)));
}

/**
 * Decoded art of one kernel. An image is rasterized once at the size it shows at and again only
 * when it shows larger, because parsing large SVGs every frame is too slow.
 */
export function createStickerArtCache(options: {
  onReady(): void;
  onError(message: string, error: unknown): void;
}): StickerArtCache {
  const images = new Map<string, ImageEntry>();
  const lotties = new Map<string, LottieEntry>();
  let disposed = false;

  function imageOf(url: string): ImageEntry {
    const known = images.get(url);
    if (known) return known;
    const image = new Image();
    const entry: ImageEntry = { image, state: "loading", raster: null };
    image.crossOrigin = "anonymous";
    image.onload = () => {
      entry.state = "ready";
      options.onReady();
    };
    image.onerror = () => {
      entry.state = "failed";
      options.onReady();
    };
    image.src = url;
    images.set(url, entry);
    return entry;
  }

  function lottieOf(url: string): LottieEntry {
    const known = lotties.get(url);
    if (known) return known;
    const entry: LottieEntry = { player: null, state: "loading" };
    lotties.set(url, entry);
    createLottiePlayer(url)
      .then((player) => {
        if (disposed) return player.dispose();
        entry.player = player;
        entry.state = "ready";
      })
      .catch((error: unknown) => {
        options.onError(`Sticker animation failed to load: ${url}`, error);
        entry.state = "failed";
      })
      .finally(() => options.onReady());
    return entry;
  }

  function dropOldRasters(): void {
    const held = [...images.values()].filter((entry) => entry.raster);
    for (const entry of held.slice(0, Math.max(0, held.length - MAX_RASTERS))) entry.raster = null;
  }

  function rasterOf(url: string, entry: ImageEntry, width: number, aspect: number) {
    const wanted = rasterWidthFor(width);
    if (entry.raster && entry.raster.width >= wanted) return entry.raster;
    const raster = document.createElement("canvas");
    raster.width = wanted;
    raster.height = Math.max(1, Math.round(wanted / aspect));
    raster.getContext("2d")?.drawImage(entry.image, 0, 0, raster.width, raster.height);
    entry.raster = raster;
    // Most recently made last, so the oldest are dropped first.
    images.delete(url);
    images.set(url, entry);
    dropOldRasters();
    return raster;
  }

  return {
    ready(art: StickerArt) {
      const entry = art.type === "lottie" ? lottieOf(art.url) : imageOf(art.url);
      return entry.state !== "loading";
    },
    draw(ctx, art, seconds, box, rasterWidth) {
      if (art.type === "lottie") {
        const { player } = lottieOf(art.url);
        player?.drawAt(ctx, seconds, box);
        return player !== null;
      }
      const entry = imageOf(art.url);
      if (entry.state !== "ready") return false;
      const raster = rasterOf(art.url, entry, rasterWidth, box.width / box.height);
      ctx.drawImage(raster, -box.width / 2, -box.height / 2, box.width, box.height);
      return true;
    },
    dispose() {
      disposed = true;
      images.clear();
      for (const { player } of lotties.values()) player?.dispose();
      lotties.clear();
    },
  };
}

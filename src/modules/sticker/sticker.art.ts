import type { StickerArt, StickerArtCache } from "./sticker.types";

/** Rasters kept at once; the oldest goes first and is made again if it shows again. */
const MAX_RASTERS = 64;

interface ImageEntry {
  image: HTMLImageElement;
  state: "loading" | "ready" | "failed";
  raster: HTMLCanvasElement | null;
}

/** The smallest power of two at least `width`, so resizing a clip doesn't raster every step. */
function rasterWidthFor(width: number): number {
  return 2 ** Math.ceil(Math.log2(Math.max(1, width)));
}

/**
 * Decoded art of one kernel. An image is rasterized once at the size it shows at and again only
 * when it shows larger, because parsing large SVGs every frame is too slow.
 */
export function createStickerArtCache(options: { onReady(): void }): StickerArtCache {
  const images = new Map<string, ImageEntry>();

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
      if (art.type === "lottie") return true;
      return imageOf(art.url).state !== "loading";
    },
    draw(ctx, art, _seconds, box, rasterWidth) {
      if (art.type === "lottie") return false;
      const entry = imageOf(art.url);
      if (entry.state !== "ready") return false;
      const raster = rasterOf(art.url, entry, rasterWidth, box.width / box.height);
      ctx.drawImage(raster, -box.width / 2, -box.height / 2, box.width, box.height);
      return true;
    },
    dispose() {
      images.clear();
    },
  };
}

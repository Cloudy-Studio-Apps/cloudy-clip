import { createLogger } from "@/core";
import type { CachedPicture } from "./engine.types";

const log = createLogger("preview.engine");

/** Decoded pixels kept at once (about 800 MB); the least recently used go first. */
const MAX_PIXELS = 200_000_000;
/** Long side an SVG is rasterized at: parsing one every frame is too slow. */
const SVG_LONG_SIDE = 2048;

interface Entry {
  state: "loading" | "ready" | "failed";
  picture?: CachedPicture;
}

/**
 * Decoded images of one engine, keyed by URL: stills and the frames of animated images. An image
 * counts as ready only once decoded, so drawing it never decodes on the frame path.
 */
export class ImageCache {
  private readonly entries = new Map<string, Entry>();
  private pixels = 0;
  private disposed = false;

  constructor(private readonly onReady: () => void) {}

  /** Starts loading a picture if needed, and marks it recently used. */
  want(url: string, { raster }: { raster: boolean }): void {
    const known = this.entries.get(url);
    if (known) {
      this.entries.delete(url);
      this.entries.set(url, known);
      return;
    }
    const entry: Entry = { state: "loading" };
    this.entries.set(url, entry);
    void this.load(url, raster, entry);
  }

  /** Whether a picture needs no more waiting: a broken one must not block the other layers. */
  ready(url: string): boolean {
    const state = this.entries.get(url)?.state;
    return state === "ready" || state === "failed";
  }

  picture(url: string): CachedPicture | undefined {
    return this.entries.get(url)?.picture;
  }

  dispose(): void {
    this.disposed = true;
    this.entries.clear();
  }

  private async load(url: string, raster: boolean, entry: Entry): Promise<void> {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.src = url;
    try {
      await image.decode();
      if (this.disposed) return;
      entry.picture = raster ? rasterize(image) : pictureOf(image);
      entry.state = "ready";
      this.pixels += entry.picture.width * entry.picture.height;
      this.evict();
    } catch (error) {
      log.warn(`Image "${url}" failed to load`, error);
      entry.state = "failed";
    }
    if (!this.disposed) this.onReady();
  }

  private evict(): void {
    for (const [url, entry] of this.entries) {
      if (this.pixels <= MAX_PIXELS) return;
      if (!entry.picture) continue;
      this.pixels -= entry.picture.width * entry.picture.height;
      this.entries.delete(url);
    }
  }
}

function pictureOf(image: HTMLImageElement): CachedPicture {
  return { source: image, width: image.naturalWidth, height: image.naturalHeight };
}

function rasterize(image: HTMLImageElement): CachedPicture {
  const aspect = image.naturalWidth / image.naturalHeight || 1;
  const canvas = document.createElement("canvas");
  canvas.width = aspect >= 1 ? SVG_LONG_SIDE : Math.max(1, Math.round(SVG_LONG_SIDE * aspect));
  canvas.height = aspect >= 1 ? Math.max(1, Math.round(SVG_LONG_SIDE / aspect)) : SVG_LONG_SIDE;
  canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
  return { source: canvas, width: canvas.width, height: canvas.height };
}

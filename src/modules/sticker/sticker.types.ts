import type { StoreApi } from "zustand";

/** The chosen option of each axis, by axis id: `{ color: "red" }`. */
export type StickerVariation = Record<string, string>;

/** Where a sticker's picture is: an SVG or PNG (`image`), or a Lottie JSON file (`lottie`). */
export interface StickerArt {
  type: "image" | "lottie";
  url: string;
}

/** A group of stickers across packs. Packs share a topic by using the same `id`. */
export interface StickerTopic {
  id: string;
  label: string;
}

/** One choice of a variation axis. `swatch` (`#rrggbb`) shows it as a color. */
export interface StickerOption {
  id: string;
  label: string;
  swatch?: string;
}

/** A way a pack's stickers can vary, such as color or style. */
export interface StickerAxis {
  id: string;
  label: string;
  options: StickerOption[];
  /** The option id used when a clip names none. */
  default: string;
}

/** One sticker of a pack. Only `id`, `label` and `art` are needed. */
export interface StickerDefinition {
  /** Unique in its pack. */
  id: string;
  label: string;
  keywords?: string[];
  /** Topic ids it shows under. */
  topics?: string[];
  /** Width over height, 1 by default. Needed up front: the size can't wait for the art. */
  aspect?: number;
  /** Ids of the pack's axes this sticker has. */
  variations?: string[];
  /** The tile's image. Give one for Lottie art, which a tile can't show as a picture. */
  thumbnail?: string;
  /** The picture for a variation with every axis of this sticker filled in. */
  art(variation: StickerVariation): StickerArt;
}

/** A pack, contributed to `stickerPacks` by a built-in module or a plugin alike. */
export interface StickerPackDefinition {
  id: string;
  name: string;
  /** Packs are listed by it, lowest first. */
  order: number;
  /** Shown above the pack's grid, for art that needs attribution. */
  credit?: string;
  /** Sticker ids for the cover; the first four when absent. */
  cover?: string[];
  /** New topics this pack introduces. */
  topics?: StickerTopic[];
  /** Axes its stickers may use. */
  variations?: StickerAxis[];
  /** The stickers, or a loader so a large list isn't in the main bundle. */
  stickers: readonly StickerDefinition[] | (() => Promise<readonly StickerDefinition[]>);
}

/** Adds an option to an axis of a pack another module owns, with its own art (a plugin's style). */
export interface StickerStyleDefinition {
  pack: string;
  axis: string;
  option: StickerOption;
  art(sticker: StickerDefinition, variation: StickerVariation): StickerArt;
}

/** A sticker and the pack it came from. */
export interface StickerHit {
  pack: string;
  sticker: StickerDefinition;
}

/** What to look for. Every given field must match. */
export interface StickerQuery {
  /** Matched against labels and keywords, ignoring case. */
  text?: string;
  topic?: string;
  pack?: string;
  limit?: number;
}

/** A recently used sticker. */
export interface StickerRecent {
  pack: string;
  sticker: string;
}

/** The recently used stickers: kept across projects, never in the document. */
export interface StickerRecents {
  store: StoreApi<{ recents: StickerRecent[] }>;
  push(recent: StickerRecent): void;
}

/** What the Stickers tab shows. Local to the panel, never in a store. */
export type StickerView =
  { kind: "home" } | { kind: "all" } | { kind: "pack"; id: string } | { kind: "topic"; id: string };

/** The sticker catalog of one kernel: packs and styles from the points, lists loaded on demand. */
export interface StickerLibrary {
  /** Every pack, lowest `order` first. */
  packs(): StickerPackDefinition[];
  /** Every topic of every pack, once each. */
  topics(): StickerTopic[];
  /** A pack's stickers, loading them once. An unknown pack has none. */
  load(pack: string): Promise<readonly StickerDefinition[]>;
  isLoaded(pack: string): boolean;
  /** Whether the last try at loading a pack failed. `load` tries again. */
  hasFailed(pack: string): boolean;
  /** A sticker of a loaded pack. */
  find(pack: string, sticker: string): StickerDefinition | undefined;
  /** The axes a sticker has, with the options styles add to them. */
  axes(pack: string, sticker: string): StickerAxis[];
  /** A sticker's picture for a variation. An option whose style is gone falls back to the default. */
  artOf(pack: string, sticker: string, variation: StickerVariation): StickerArt | undefined;
  /** Stickers across every pack that matches, loading what it needs. */
  search(query: StickerQuery): Promise<StickerHit[]>;
  /** Called when a pack's list has loaded. Returns an unsubscribe function. */
  onLoaded(listener: () => void): () => void;
}

/** What the sticker module offers other modules and plugins. */
export interface StickerApi extends StickerLibrary {
  recents: StickerRecents;
}

/** One seal expression: the parts drawn on top of the shared head. */
export interface SealFace {
  /** Eyes (and brows). */
  eyes: string;
  /** Drawn under the muzzle; the muzzle alone reads as a calm ω. */
  mouth?: string;
  /** Drawn behind the head (raised flippers). */
  back?: string;
  /** Drawn over everything (props, hearts, tears). */
  front?: string;
  /** Opacity of the blush on the cheeks (0.75 by default). */
  blush?: number;
}

/** One sticker of the Editing pack: its markup for a color and its outline. */
export interface EditingShape {
  id: string;
  label: string;
  topic: "arrows" | "marks" | "bubbles";
  keywords: string[];
  /** Height of its 128-wide grid, 128 by default. */
  height?: number;
  draw(color: string, outline: string): string;
}

/** A sticker clip's stored values: references to the art, never the art itself. */
export interface StickerProps {
  pack: string;
  sticker: string;
  variation: StickerVariation;
}

/** Decoded art of one kernel: loaded on first use, drawn without reloading. */
export interface StickerArtCache {
  /** Whether `draw` can paint this art; starts loading it. True once loading has failed. */
  ready(art: StickerArt): boolean;
  /**
   * Paints the art centered on the origin, `box` in the context's units, at `seconds` for moving
   * art. `rasterWidth` is its width in canvas pixels. False when there is nothing to paint.
   */
  draw(
    ctx: CanvasRenderingContext2D,
    art: StickerArt,
    seconds: number,
    box: { width: number; height: number },
    rasterWidth: number,
  ): boolean;
  dispose(): void;
}

declare module "@/modules/element" {
  interface CustomProps {
    /** `prop.custom("sticker-variation", {})`: the chosen option of each of a sticker's axes. */
    "sticker-variation": Record<string, never>;
  }
  interface CustomValues {
    "sticker-variation": StickerVariation;
  }
}

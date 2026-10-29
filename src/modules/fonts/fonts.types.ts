import type { FontSource, FontWeight } from "@/modules/project";

/** One face of a family: its weight and style. */
export interface FontVariant {
  weight: FontWeight;
  style: "normal" | "italic";
}

/** A face of a family, as text asks for it to be loaded. */
export interface FontRequest extends FontVariant {
  family: string;
  source: FontSource;
}

/** A font family the picker offers. */
export interface FontFamily {
  family: string;
  source: FontSource;
  /** Google's category (`sans-serif`, `serif`, `display`, ...), when known. */
  category?: string;
  /** Its faces, upright first. */
  variants: FontVariant[];
}

/** One face file of a Google font, read from Google's CSS. */
export interface FontFaceSource {
  url: string;
  /** The CSS `unicode-range` it covers, when the CSS splits the face by script. */
  unicodeRange?: string;
}

/** Whether a face is ready to draw. */
export type FontStatus = "loaded" | "loading" | "missing";

/** An installed face as the native side reports it. */
export interface InstalledFace {
  family: string;
  /** Raw weight, e.g. 350; rounded to a CSS weight when grouped. */
  weight: number;
  italic: boolean;
}

/** The native and network side of fonts. Faked in tests. */
export interface FontService {
  /** Every installed face. */
  installed(): Promise<InstalledFace[]>;
  /** Google's families: cache while fresh (7 days), else downloaded and cached, else stale, else a fallback list. */
  googleCatalog(): Promise<FontFamily[]>;
  /** Downloads (or reads from the cache) a Google face and registers it with the document. */
  loadGoogleFace(request: FontRequest): Promise<boolean>;
  /** Waits for an installed or bundled face drawn by name; true when the browser has it. */
  loadByName(request: FontRequest): Promise<boolean>;
}

/** Fonts API of the `fonts` module. */
export interface FontsApi {
  /** Bundled, installed, then Google families. Read once per kernel; offline still resolves. */
  families(): Promise<FontFamily[]>;
  /** Loads a face once per kernel. Resolves true when it can be drawn; never rejects. */
  load(request: FontRequest): Promise<boolean>;
  /** The state of a face; `undefined` when it was never requested. */
  status(request: FontRequest): FontStatus | undefined;
  /** True when the face is loaded; otherwise starts loading it and returns false. */
  ensure(request: FontRequest): boolean;
  /** Called when a face finishes loading (or turns out missing). Returns the unsubscribe. */
  onLoaded(listener: (request: FontRequest) => void): () => void;
}

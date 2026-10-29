/** Weight of a font, as CSS numbers. */
export type FontWeight = "100" | "200" | "300" | "400" | "500" | "600" | "700" | "800" | "900";

/** Where a font comes from: shipped with the app, installed on the system, or Google Fonts. */
export type FontSource = "bundled" | "installed" | "google";

/** A font family and where to get it. */
export interface FontRef {
  family: string;
  source: FontSource;
}

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

/** Face statuses by `fontKey`. */
export interface FontStatusState {
  statuses: Record<string, FontStatus>;
}

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
  /**
   * The families once `families()` has resolved, else `undefined`. Synchronous, so commands can
   * check a family without waiting on the network; they skip the check while it is `undefined`.
   */
  knownFamilies(): FontFamily[] | undefined;
  /** Loads a face once per kernel. Resolves true when it can be drawn; never rejects. A failed face is tried again by the next `load`. */
  load(request: FontRequest): Promise<boolean>;
  /** The state of a face; `undefined` when it was never requested. */
  status(request: FontRequest): FontStatus | undefined;
  /** True when the face is loaded; otherwise starts loading it and returns false. */
  ensure(request: FontRequest): boolean;
  /** Called when a face finishes loading (or turns out missing). Returns the unsubscribe. */
  onLoaded(listener: (request: FontRequest) => void): () => void;
}

declare module "@/modules/element" {
  interface CustomProps {
    /** `prop.custom("font", { sources })`: a family from these sources. */
    font: { sources: readonly FontSource[] };
  }
  interface CustomValues {
    font: FontRef;
  }
}

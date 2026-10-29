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

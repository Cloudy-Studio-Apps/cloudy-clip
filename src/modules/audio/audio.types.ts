/** The audio module has no API. */
export type AudioApi = Record<string, never>;

/** A part of a clip's sound that resets on its own. */
export type SoundSection = "volume" | "pan" | "fades" | "pitch" | "eq";

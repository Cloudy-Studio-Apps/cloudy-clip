import { z } from "zod";

/** A subtitle preset id. */
export const subtitlePresetId = z.enum(["classic", "punchy", "intense", "whisper"]);

/** A style's name: 1 to 60 characters. */
export const styleName = z.string().trim().min(1).max(60);

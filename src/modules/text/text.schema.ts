import { z } from "zod";

/** Names of the presets, for command inputs. */
export const textPresetId = z.enum(["title", "highlight", "outline", "pop", "lower-third"]);

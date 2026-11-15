import type { InputColorSpace } from "@/modules/project";
import type { SpaceName } from "./ui.types";

/** Each camera color space by name: in full for the LUT tool, short for Baby Seal's flow label. */
export const SPACE_NAMES: Record<InputColorSpace, SpaceName> = {
  rec709: { name: "Rec.709", short: "Rec.709" },
  srgb: { name: "sRGB", short: "sRGB" },
  slog3: { name: "Sony S-Log3 / S-Gamut3.Cine", short: "S-Log3" },
  appleLog: { name: "Apple Log", short: "Apple Log" },
  clog2: { name: "Canon C-Log2", short: "C-Log2" },
  clog3: { name: "Canon C-Log3", short: "C-Log3" },
  vlog: { name: "Panasonic V-Log", short: "V-Log" },
  flog: { name: "Fujifilm F-Log", short: "F-Log" },
};

import type { FontFamily } from "@/modules/fonts";
import type { TextStyle } from "../../text.types";
import { useFamilies } from "../text.fonts.hook";

/** The family of the clip's font in the offered list (undefined until the list loads, or when missing). */
export function useClipFamily(values: Record<string, unknown>): FontFamily | undefined {
  const families = useFamilies();
  const font = (values as unknown as TextStyle).font;
  return families.find((f) => f.family === font.family && f.source === font.source);
}

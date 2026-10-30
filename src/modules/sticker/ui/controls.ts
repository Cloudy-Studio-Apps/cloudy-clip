import type { PropertyControl, SectionLayout } from "@/modules/inspector";
import { VariationControl } from "./VariationControl";
import { VariationSection } from "./VariationSection";

/** The inspector control of a sticker's variations. */
export const stickerControls: PropertyControl[] = [
  { id: "sticker-variation", for: "field", component: VariationControl },
];

/** The section that holds them, left out when a sticker has nothing to choose. */
export const stickerSections: SectionLayout[] = [
  { id: "sticker-variation", component: VariationSection },
];

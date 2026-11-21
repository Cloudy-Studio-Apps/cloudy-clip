import type { InspectorSectionItem } from "@/modules/inspector";
import { MaskSection } from "./MaskSection";
import { MatteSection } from "./MatteSection";

export { MaskDrawing } from "./MaskDrawing";
export { MaskOverlay } from "./MaskOverlay";

const picture: InspectorSectionItem["appliesTo"] = ({ track }) => track.kind === "video";

/** The Mask tab's sections: presets, list and fields; then the track matte. */
export const maskSections: InspectorSectionItem[] = [
  {
    id: "mask.section",
    tab: "mask",
    title: "Mask",
    order: 0,
    appliesTo: picture,
    bare: true,
    component: MaskSection,
  },
  {
    id: "mask.matte",
    tab: "mask",
    title: "Track matte",
    order: 100,
    appliesTo: picture,
    bare: true,
    component: MatteSection,
  },
];

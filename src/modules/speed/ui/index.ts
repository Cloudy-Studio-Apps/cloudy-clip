import type { InspectorSectionItem } from "@/modules/inspector";
import { canChangeSpeed } from "@/modules/project";
import { SpeedSection } from "./SpeedSection";

/** Public UI of the speed module. */
export { SpeedBox } from "./SpeedBox";

/** The section in the Video tab, right after Transform (order 900). */
export const speedSection: InspectorSectionItem = {
  id: "speed.section",
  tab: "video",
  title: "Speed",
  order: 901,
  bare: true,
  appliesTo: ({ clip }, project) => canChangeSpeed(project, clip),
  component: SpeedSection,
};

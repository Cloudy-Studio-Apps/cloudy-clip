import type { InspectorSectionItem } from "../inspector.types";
import { InfoSection } from "./InfoSection";
import { clipJunctions, JunctionsSection } from "./JunctionsSection";
import { soundMember, SoundSection } from "./SoundSection";
import { TimingSection } from "./TimingSection";

/** The sections the inspector adds to a clip's panel, the same way a plugin would. */
export const builtinSections: InspectorSectionItem[] = [
  {
    id: "inspector.sound",
    tab: "audio",
    title: "Sound",
    order: 100,
    appliesTo: (context) => soundMember(context) !== undefined,
    component: SoundSection,
  },
  {
    id: "inspector.junctions",
    tab: "transition",
    title: "Transition",
    order: 100,
    appliesTo: (context, project) => clipJunctions(context, project).length > 0,
    bare: true,
    component: JunctionsSection,
  },
  { id: "inspector.timing", tab: "file", title: "Timing", order: 100, component: TimingSection },
  { id: "inspector.info", tab: "file", title: "Info", order: 200, component: InfoSection },
];

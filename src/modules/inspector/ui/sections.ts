import type { InspectorSectionItem } from "../inspector.types";
import { FileMetadataSection, FileSection } from "./FileSections";
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
  {
    id: "inspector.file",
    tab: "file",
    title: "File",
    order: 50,
    appliesTo: ({ clip }) => clip.mediaId !== undefined,
    component: FileSection,
  },
  {
    id: "inspector.metadata",
    tab: "file",
    title: "Metadata",
    order: 60,
    appliesTo: ({ clip }) => clip.mediaId !== undefined,
    component: FileMetadataSection,
  },
  { id: "inspector.timing", tab: "file", title: "Timing", order: 100, component: TimingSection },
];

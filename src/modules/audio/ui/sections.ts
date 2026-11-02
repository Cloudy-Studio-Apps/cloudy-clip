import { soundMember, type InspectorContext, type InspectorSectionItem } from "@/modules/inspector";
import { FadesSection, PanSection, PitchSection, VolumeSection } from "./AudioSections";
import { EqSection } from "./EqSection";

const hasSound = (context: InspectorContext) => soundMember(context) !== undefined;
/** A placed composition takes volume and fades on top of its clips; the rest is per file. */
const playsFile = (context: InspectorContext) =>
  soundMember(context)?.clip.compositionRef === undefined && hasSound(context);

/** The Audio tab, above the track and mute of the inspector's own Sound section. */
export const audioSections: InspectorSectionItem[] = [
  {
    id: "audio.volume",
    tab: "audio",
    title: "Volume",
    order: 10,
    appliesTo: hasSound,
    component: VolumeSection,
  },
  {
    id: "audio.pan",
    tab: "audio",
    title: "Pan",
    order: 20,
    appliesTo: playsFile,
    component: PanSection,
  },
  {
    id: "audio.fades",
    tab: "audio",
    title: "Fades",
    order: 30,
    appliesTo: hasSound,
    component: FadesSection,
  },
  {
    id: "audio.pitch",
    tab: "audio",
    title: "Pitch",
    order: 40,
    bare: true,
    appliesTo: playsFile,
    component: PitchSection,
  },
  {
    id: "audio.eq",
    tab: "audio",
    title: "Equalizer",
    order: 50,
    bare: true,
    appliesTo: playsFile,
    component: EqSection,
  },
];

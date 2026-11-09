import type { SoonEntry, SoonId } from "../../sound.types";

/**
 * Every control of the Sound page that is drawn now and works later (Ruling 1 of
 * `docs/superpowers/plans/2026-11-03-sound-layout.md`), with the stage that builds it. Each stage
 * removes its entries here, and its `soon(…)` calls, as it makes them work; when nothing is left,
 * the `ui/soon/` folder goes.
 */
export const SOON: Record<SoonId, SoonEntry> = {
  "transport.findBeats": {
    id: "transport.findBeats",
    label: "Find beats",
    what: "Marks the beats of a music clip under the ruler.",
    stage: 6,
  },
  "transport.stripSilence": {
    id: "transport.stripSilence",
    label: "Strip silence",
    what: "Cuts the silent stretches out of a clip.",
    stage: 6,
  },
  "transport.matchLevel": {
    id: "transport.matchLevel",
    label: "Match level",
    what: "Brings the selected clips to the same loudness.",
    stage: 6,
  },
  "mixer.filter": {
    id: "mixer.filter",
    label: "Filter",
    what: "Shows the strips of one group at a time.",
    stage: 4,
  },
  "master.pan": {
    id: "master.pan",
    label: "Master pan",
    what: "Balances the whole mix left and right.",
    stage: 4,
  },
  "master.mute": {
    id: "master.mute",
    label: "Master mute",
    what: "Silences the whole mix.",
    stage: 4,
  },
  "master.read": {
    id: "master.read",
    label: "Master read",
    what: "Plays back the volume drawn or recorded on the master.",
    stage: 4,
  },
  "compressor.reduction": {
    id: "compressor.reduction",
    label: "Reduction",
    what: "Shows how far the compressor turns the sound down as it plays.",
    stage: "2-followup",
  },
  "loudness.spectrum": {
    id: "loudness.spectrum",
    label: "Frequency spectrum",
    what: "Shows how loud each frequency of the mix is as it plays.",
    stage: 5,
  },
  "loudness.phase": {
    id: "loudness.phase",
    label: "Stereo phase",
    what: "Shows how far left and right agree, and whether the mix holds up in mono.",
    stage: 5,
  },
  "deliver.standard": {
    id: "deliver.standard",
    label: "Delivery standard",
    what: "Picks the loudness and peak limit a platform asks for.",
    stage: 5,
  },
  "deliver.analyze": {
    id: "deliver.analyze",
    label: "Analyze whole mix",
    what: "Measures the whole mix against the standard and lists what goes over.",
    stage: 5,
  },
  "deliver.format": {
    id: "deliver.format",
    label: "Audio format",
    what: "Chooses the codec and sample rate of the exported sound.",
    stage: 4,
  },
  "deliver.stems": {
    id: "deliver.stems",
    label: "Stems",
    what: "Exports the full mix, or each group, as files of their own.",
    stage: 4,
  },
};

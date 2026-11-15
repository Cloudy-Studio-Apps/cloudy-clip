import type { SoonEntry, SoonId } from "../../sound.types";

/**
 * Every control of the Sound page that is drawn now and works later (Ruling 1 of
 * `docs/superpowers/plans/2026-11-03-sound-layout.md`), with the stage that builds it. Each stage
 * removes its entries here, and its `soon(…)` calls, as it makes them work; when nothing is left,
 * the `ui/soon/` folder goes.
 */
export const SOON: Record<SoonId, SoonEntry> = {
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
  "compressor.reduction": {
    id: "compressor.reduction",
    label: "Reduction",
    what: "Shows how far the compressor turns the sound down as it plays.",
    stage: "2-followup",
  },
};

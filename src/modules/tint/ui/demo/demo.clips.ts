import type { DemoLook } from "./demo.types";

/** Built-in looks and one grabbed still. */
export const DEMO_LOOKS: readonly DemoLook[] = [
  {
    id: "still1",
    name: "Golden hour",
    note: "your still",
    look: "sepia(.35) saturate(1.2) contrast(1.05)",
  },
  {
    id: "teal",
    name: "Teal and orange",
    note: "look",
    look: "hue-rotate(-12deg) saturate(1.35) contrast(1.1)",
  },
  { id: "bleach", name: "Bleach bypass", note: "look", look: "saturate(.45) contrast(1.35)" },
  { id: "soft", name: "Soft film", note: "look", look: "contrast(.9) brightness(1.05) sepia(.15)" },
  {
    id: "night",
    name: "Night blue",
    note: "look",
    look: "hue-rotate(190deg) saturate(.6) brightness(.8)",
  },
  { id: "mono", name: "Mono", note: "look", look: "grayscale(1) contrast(1.15)" },
];

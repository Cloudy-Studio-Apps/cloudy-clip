import { DEMO_IMAGES } from "./demo.images";
import type { DemoClip, DemoLook } from "./demo.types";

/** The open composition's picture clips, in time order. */
export const DEMO_CLIPS: readonly DemoClip[] = [
  {
    id: "c1",
    from: 0,
    to: 4,
    no: "01",
    name: "Plaza",
    track: "V1",
    start: "0:00",
    meta: "ProRes 422 HQ · 25p",
    graded: true,
    image: DEMO_IMAGES.plaza,
  },
  {
    id: "c2",
    from: 4,
    to: 9,
    no: "02",
    name: "Plaza wide",
    track: "V1",
    start: "0:04",
    meta: "ProRes 422 HQ · 25p",
    graded: true,
    image: DEMO_IMAGES.plaza,
  },
  {
    id: "c3",
    from: 9,
    to: 13,
    no: "03",
    name: "Highway",
    track: "V1",
    start: "0:09",
    meta: "H.265 · 50p",
    graded: false,
    image: DEMO_IMAGES.highway,
  },
  {
    id: "c4",
    from: 11,
    to: 14,
    no: "04",
    name: "City",
    track: "V2",
    start: "0:11",
    meta: "ProRes 4444 · 25p",
    graded: true,
    image: DEMO_IMAGES.city,
  },
  {
    id: "c5",
    from: 13,
    to: 18,
    no: "05",
    name: "Meadow",
    track: "V1",
    start: "0:18",
    meta: "DNxHR HQ · 25p",
    graded: false,
    image: DEMO_IMAGES.meadow,
  },
  {
    id: "c6",
    from: 18,
    to: 25,
    no: "06",
    name: "Wheat",
    track: "V1",
    start: "0:22",
    meta: "H.264 · 30p",
    graded: false,
    image: DEMO_IMAGES.wheat,
  },
  {
    id: "c7",
    from: 25,
    to: 29,
    no: "07",
    name: "Tractor",
    track: "V2",
    start: "0:25",
    meta: "H.265 · 50p",
    graded: false,
    image: DEMO_IMAGES.tractor,
  },
  {
    id: "c8",
    from: 29,
    to: 36,
    no: "08",
    name: "Plane",
    track: "V1",
    start: "0:31",
    meta: "DNxHR HQ · 25p",
    graded: false,
    image: DEMO_IMAGES.plane,
  },
];

/** Length of the demo composition, in seconds. */
export const DEMO_LENGTH = 36;

/** The clip being graded in the demo. */
export const DEMO_CURRENT = "c2";

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

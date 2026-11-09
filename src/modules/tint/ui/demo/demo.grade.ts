import type { DemoNode, DemoRegion, DemoWire } from "./demo.types";

/** The same grade as Leader Seal draws it, in a 1030 × 380 view box. */
export const DEMO_NODES: readonly DemoNode[] = [
  { id: "n1", kind: "correct", no: "01", label: "Balance", x: 70, y: 150, layer: "n1" },
  { id: "n2", kind: "correct", no: "02", label: "Contrast", x: 215, y: 150, layer: "n2" },
  { id: "n3", kind: "correct", no: "03", label: "Skin", x: 385, y: 55, badge: "KEY", layer: "n3" },
  { id: "n4", kind: "correct", no: "04", label: "Sky", x: 385, y: 245, badge: "KEY", layer: "n4" },
  { id: "g1", kind: "join", label: "Side by side", x: 540, y: 177, layer: "g1" },
  {
    id: "n5",
    kind: "correct",
    no: "05",
    label: "Warm look",
    x: 610,
    y: 150,
    badge: "LUT",
    layer: "n5",
  },
  { id: "sp", kind: "split", label: "Split", x: 765, y: 177, layer: "s1" },
  { id: "n6", kind: "channel", label: "Red", channel: "r", x: 828, y: 76, layer: "s1" },
  { id: "n7", kind: "channel", label: "Green", channel: "g", x: 828, y: 173, layer: "s1" },
  { id: "n8", kind: "channel", label: "Blue", channel: "b", x: 828, y: 270, layer: "s1" },
  { id: "mg", kind: "merge", label: "Join", x: 920, y: 177, layer: "s1" },
];

/** Wires of the demo graph; `source` and `out` are the graph's ends. */
export const DEMO_WIRES: readonly DemoWire[] = [
  { from: "source", to: "n1", kind: "picture" },
  { from: "n1", to: "n2", kind: "picture" },
  { from: "n2", to: "n3", kind: "picture" },
  { from: "n2", to: "n4", kind: "picture" },
  { from: "n3", to: "g1", kind: "picture" },
  { from: "n4", to: "g1", kind: "picture" },
  { from: "g1", to: "n5", kind: "picture" },
  { from: "n5", to: "sp", kind: "picture" },
  { from: "sp", to: "n6", kind: "r" },
  { from: "sp", to: "n7", kind: "g" },
  { from: "sp", to: "n8", kind: "b" },
  { from: "n6", to: "mg", kind: "r" },
  { from: "n7", to: "mg", kind: "g" },
  { from: "n8", to: "mg", kind: "b" },
  { from: "mg", to: "out", kind: "picture" },
];

/** Groups Baby Seal knows, drawn as dashed boxes in Leader Seal. */
export const DEMO_REGIONS: readonly DemoRegion[] = [
  { label: "Skin and sky · Side by side", x: 368, y: 34, width: 232, height: 318 },
  { label: "Channel split · Wired in Leader Seal", x: 748, y: 56, width: 226, height: 282 },
];

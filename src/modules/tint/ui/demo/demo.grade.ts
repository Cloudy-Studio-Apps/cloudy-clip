import type { DemoItem, DemoNode, DemoRegion, DemoWire } from "./demo.types";

const warm = "contrast(1.1) saturate(1.05) sepia(0.12)";

/** The demo grade as Baby Seal shows it, top (nearest the source) to bottom. */
export const DEMO_STACK: readonly DemoItem[] = [
  {
    type: "layer",
    id: "n1",
    no: "01",
    name: "Balance",
    on: true,
    opacity: 100,
    chip: { kind: "whole", label: "White balance and exposure" },
    look: "sepia(0.08)",
  },
  {
    type: "layer",
    id: "n2",
    no: "02",
    name: "Contrast",
    on: true,
    opacity: 100,
    chip: { kind: "whole", label: "Whole picture" },
    look: "contrast(1.14) sepia(0.08)",
  },
  {
    type: "group",
    id: "g1",
    name: "Skin and sky",
    kind: "parallel",
    on: true,
    opacity: 100,
    layers: [
      {
        type: "layer",
        id: "n3",
        no: "03",
        name: "Skin",
        on: true,
        opacity: 100,
        chip: { kind: "key", label: "Color key" },
        look: warm,
      },
      {
        type: "layer",
        id: "n4",
        no: "04",
        name: "Sky",
        on: true,
        opacity: 100,
        chip: { kind: "key", label: "Color key" },
        look: "contrast(1.12) saturate(1.12) hue-rotate(-6deg)",
      },
    ],
  },
  {
    type: "layer",
    id: "n5",
    no: "05",
    name: "Warm look",
    on: true,
    opacity: 80,
    chip: { kind: "lut", label: "LUT Golden hour" },
    look: "contrast(1.12) saturate(0.95) sepia(0.22)",
  },
  {
    type: "sealed",
    id: "s1",
    name: "Channel split",
    nodes: 5,
    on: true,
    layers: [
      {
        type: "layer",
        id: "n6",
        no: "06",
        name: "Red",
        on: true,
        opacity: 100,
        chip: { kind: "whole", label: "Red channel" },
        look: warm,
      },
      {
        type: "layer",
        id: "n7",
        no: "07",
        name: "Green",
        on: true,
        opacity: 100,
        chip: { kind: "whole", label: "Green channel" },
        look: warm,
      },
      {
        type: "layer",
        id: "n8",
        no: "08",
        name: "Blue",
        on: true,
        opacity: 100,
        chip: { kind: "whole", label: "Blue channel" },
        look: warm,
      },
    ],
  },
];

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

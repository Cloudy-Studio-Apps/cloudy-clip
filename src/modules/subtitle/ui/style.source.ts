import { prop, type LayoutSource, type PropertyTree } from "@/modules/element";
import { layoutSourceOf } from "@/modules/inspector";
import { textElement } from "@/modules/text";

// The words are a cue's own, edited in the list; a style has everything else a text clip has.
const look: PropertyTree = Object.fromEntries(
  Object.entries(textElement.properties).filter(([key]) => key !== "text"),
);
const sections = (textElement.layout ?? []).filter((section) => !section.items.includes("text"));

/** A cue's look in the text element's own sections, without its words. */
export const cueSource: LayoutSource = {
  ...layoutSourceOf("text", look),
  definition: { kind: "text", properties: look, layout: sections },
};

const position = (label: string) => prop.number({ label, unit: "px", ui: { step: 1 } });
const styleTree: PropertyTree = {
  ...look,
  position: prop.group({ label: "Position" }, { x: position("X"), y: position("Y") }),
};

/** A style's values: a cue's look, then Position (x / y from the frame's center). */
export const styleSource: LayoutSource = {
  ...layoutSourceOf("subtitle-style", styleTree),
  definition: {
    kind: "subtitle-style",
    properties: styleTree,
    layout: [...sections, { title: "Position", tab: "text", items: ["position"] }],
  },
};

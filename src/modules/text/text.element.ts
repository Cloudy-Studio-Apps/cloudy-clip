import { Type } from "lucide-react";
import { defineElement, prop } from "@/modules/element";
import { fontsRef } from "@/modules/fonts";
import { checkExplicitFace } from "./logic/faces";
import { DEFAULT_TEXT, defaultTextStyle, textLayout } from "./logic/layout";
import { presetStyle, presetTransform } from "./logic/presets";
import { snapStyleToFamily } from "./logic/snap";
import { drawText } from "./text.draw";
import { textPanelLayout } from "./text.panel";
import type { TextProps } from "./text.types";

const opacity = (o: { label?: string } = {}) =>
  prop.number({
    ...o,
    min: 0,
    max: 1,
    step: 0.01,
    display: { scale: 100, unit: "%" },
    control: "slider",
  });

/** A text clip's declared values: words, font and the look of fill, outline, background, shadow. */
export const textProperties = {
  text: prop.string({ min: 1, trim: true, multiline: true, label: "Words" }),
  font: prop.custom("font", { sources: ["bundled", "installed", "google"] }),
  size: prop.number({
    min: 1,
    max: 2000,
    unit: "px",
    control: "slider",
    ui: { min: 8, max: 400, step: 1 },
  }),
  weight: prop.enum(["100", "200", "300", "400", "500", "600", "700", "800", "900"], {
    control: "font-weight",
  }),
  italic: prop.boolean({ control: "font-italic" }),
  letterSpacing: prop.number({
    min: -200,
    max: 1000,
    unit: "px",
    control: "slider",
    label: "Letters",
    ui: { min: -20, max: 100, step: 0.5 },
  }),
  lineHeight: prop.number({
    min: 0.5,
    max: 4,
    unit: "×",
    control: "slider",
    label: "Lines",
    ui: { min: 0.8, max: 2.5, step: 0.05 },
  }),
  align: prop.enum(["left", "center", "right"]),
  uppercase: prop.boolean({ control: "icon-toggle", icon: "CaseUpper" }),
  fill: prop.group(
    { label: "Fill" },
    { color: prop.color({ opacity: "opacity" }), opacity: opacity({ label: "Opacity" }) },
  ),
  outline: prop.group(
    { label: "Outline", toggle: "enabled" },
    {
      enabled: prop.boolean(),
      color: prop.color(),
      width: prop.number({
        min: 0,
        max: 200,
        unit: "px",
        control: "slider",
        ui: { max: 100, step: 0.5 },
      }),
    },
  ),
  background: prop.group(
    { label: "Background", toggle: "enabled" },
    {
      enabled: prop.boolean(),
      color: prop.color({ opacity: "opacity" }),
      opacity: opacity(),
      padding: prop.number({
        min: 0,
        max: 500,
        unit: "px",
        control: "slider",
        ui: { max: 300, step: 1 },
      }),
      radius: prop.number({
        min: 0,
        max: 500,
        unit: "px",
        control: "slider",
        ui: { max: 300, step: 1 },
      }),
    },
  ),
  shadow: prop.group(
    { label: "Shadow", toggle: "enabled" },
    {
      enabled: prop.boolean(),
      color: prop.color({ opacity: "opacity" }),
      opacity: opacity(),
      blur: prop.number({
        min: 0,
        max: 500,
        unit: "px",
        control: "slider",
        ui: { max: 100, step: 0.5 },
      }),
      distance: prop.number({
        min: 0,
        max: 500,
        unit: "px",
        control: "slider",
        ui: { max: 100, step: 0.5 },
      }),
      angle: prop.number({
        min: -180,
        max: 360,
        unit: "°",
        control: "slider",
        ui: { min: 0, max: 360, step: 1 },
      }),
    },
  ),
};

/**
 * Text over the video: words in a font, with fill, outline, background box and shadow. No source
 * file, so it can be any length; it sits on video tracks and is placed with the transform tools.
 */
export const textElement = defineElement<typeof textProperties, TextProps>({
  kind: "text",
  name: "Text",
  source: "none",
  tracks: ["video"],
  supports: { transform: true, composite: true },
  properties: textProperties,
  layout: textPanelLayout,
  defaults: (format) => ({ text: DEFAULT_TEXT, ...defaultTextStyle(format) }),
  normalize(next, env) {
    // Only a list that is already loaded is checked; commands never wait for the network.
    const families = env.require(fontsRef).knownFamilies();
    checkExplicitFace(next, env.patch, families);
    return { ...next, ...snapStyleToFamily(next, families) };
  },
  display: (clip) => ({
    icon: Type,
    color: "clip-type",
    label: typeof clip.props.text === "string" ? clip.props.text : DEFAULT_TEXT,
    body: "none",
  }),
  create: [
    { panel: "text", id: "plain", label: "Text" },
    { panel: "text", id: "title", label: "Title", props: (format) => presetStyle("title", format) },
    {
      panel: "text",
      id: "lower-third",
      label: "Lower third",
      props: (format) => ({
        ...presetStyle("lower-third", format),
        transform: presetTransform("lower-third", format),
      }),
    },
  ],
  picture: {
    fit: "none",
    size: (props, env) => textLayout(props.text, props, env.measure).box,
    draw: drawText,
  },
});

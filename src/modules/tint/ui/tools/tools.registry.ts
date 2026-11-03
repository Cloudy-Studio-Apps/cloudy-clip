import {
  Blend,
  Box,
  CircleDot,
  Focus,
  Orbit,
  SlidersHorizontal,
  Sparkles,
  Spline,
  Sun,
  WandSparkles,
} from "lucide-react";
import { BasicsTool } from "./BasicsTool";
import { ColorMixTool } from "./ColorMixTool";
import { CreativeTool } from "./CreativeTool";
import { CurvesTool } from "./CurvesTool";
import { LimitTool } from "./LimitTool";
import { LutTool } from "./LutTool";
import { MatchTool } from "./MatchTool";
import { MixerTool } from "./MixerTool";
import type { ToolEntry } from "./tools.types";
import { WarperTool } from "./WarperTool";
import { WheelsTool } from "./WheelsTool";

/** The tools in rail order. Basics stands apart at the top. */
export const TOOLS: readonly ToolEntry[] = [
  {
    id: "basics",
    name: "Basics",
    icon: Sun,
    key: "1",
    component: BasicsTool,
    tip: "Exposure, contrast and white balance. Start here.",
  },
  {
    id: "wheels",
    name: "Color wheels",
    icon: CircleDot,
    key: "2",
    component: WheelsTool,
    tip: "Lift, gamma, gain and offset: push color into the darks, mids and brights.",
  },
  {
    id: "curves",
    name: "Curves",
    icon: Spline,
    key: "3",
    component: CurvesTool,
    tip: "Bend brightness and color with points. Hue curves change one color only.",
  },
  {
    id: "cmix",
    name: "Color mix",
    icon: Blend,
    key: "4",
    component: ColorMixTool,
    tip: "Change one color family, like grass, sky or skin, without picking.",
  },
  {
    id: "warper",
    name: "Warper",
    icon: Orbit,
    component: WarperTool,
    tip: "A grid over the colors. Drag a point to bend a hue or its strength.",
  },
  {
    id: "creative",
    name: "Creative",
    icon: Sparkles,
    key: "5",
    component: CreativeTool,
    tip: "Split toning, faded film and vignette.",
  },
  {
    id: "limit",
    name: "Limit",
    icon: Focus,
    key: "6",
    component: LimitTool,
    tip: "Change only some colors or some brightness. Without a limit, the whole frame.",
  },
  {
    id: "luts",
    name: "LUT and color",
    icon: Box,
    key: "7",
    component: LutTool,
    tip: "Convert camera log footage and add film looks.",
  },
  {
    id: "match",
    name: "Match",
    icon: WandSparkles,
    key: "8",
    component: MatchTool,
    tip: "Auto balance, pick white, match this shot to another.",
  },
  {
    id: "mixer",
    name: "RGB mixer",
    icon: SlidersHorizontal,
    key: "9",
    component: MixerTool,
    tip: "Mix the red, green and blue channels into each other.",
  },
];

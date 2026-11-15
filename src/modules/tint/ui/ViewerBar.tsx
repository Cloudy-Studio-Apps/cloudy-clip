import {
  Crosshair,
  Grid3x3,
  Maximize2,
  Power,
  Rainbow,
  SquareSplitHorizontal,
  TriangleAlert,
} from "lucide-react";
import { useStore } from "zustand";
import { useKernel, useModule } from "@/core";
import { previewRef } from "@/modules/preview";
import { IconButton } from "@/ui";
import { HeaderRule } from "./HeaderRule";
import { SpaceChip } from "./SpaceChip";
import { ZoomChip } from "./ZoomChip";
import { SideMenu } from "./SideMenu";
import type { ViewerTool } from "./ui.types";
import { useTintView } from "./view.hook";
import { useTintSet } from "./view.set.hook";
import { setClean } from "../tint.viewer.commands";

/** The viewer's live tools: the first two are the preview's own picture state, the rest the page's view. */
const TOOLS: readonly ViewerTool[] = [
  {
    key: "compare",
    icon: SquareSplitHorizontal,
    label: "Before / after: wipe between the original and the grade",
  },
  { key: "bypass", icon: Power, label: "Bypass grades: see every clip with no grade (Shift+D)" },
  {
    key: "samples",
    icon: Crosshair,
    label: "Sample points: hover to read a color, click to pin up to three",
  },
  {
    key: "falseColor",
    icon: Rainbow,
    label: "False color: paint the picture by brightness (viewer only, never exported)",
  },
  {
    key: "warning",
    icon: TriangleAlert,
    label: "Clip warning: magenta over clipped whites (viewer only, never exported)",
  },
  { key: "guides", icon: Grid3x3, label: "Guides: action and title safe areas" },
];

function ToolButton({ tool }: { tool: ViewerTool }) {
  const { picture } = useModule(previewRef);
  const set = useTintSet();
  const key = tool.key;
  const preview = useStore(picture.view, (v) =>
    key === "compare" ? v.compare !== null : key === "bypass" && v.bypass,
  );
  const mine = useTintView((v) =>
    key === "compare" || key === "bypass" ? false : key === "samples" ? v.samples !== null : v[key],
  );
  const overridden = useTintView((v) => key === "warning" && v.falseColor);
  const on = (preview || mine) && !overridden;
  const Icon = tool.icon;
  const toggle = () => {
    if (overridden) return;
    if (key === "compare") picture.setCompare(on ? null : 0.5);
    else if (key === "bypass") picture.setBypass(!on);
    else if (key === "samples") set({ samples: on ? null : [] });
    else set({ [key]: !on });
  };
  return (
    <IconButton
      label={
        overridden
          ? `${tool.label}. Off while false color is on: its last band marks clipping`
          : tool.label
      }
      active={on}
      onClick={toggle}
    >
      <Icon />
    </IconButton>
  );
}

/** The viewer header's tool buttons, the color space and the zoom. */
export function ViewerBar() {
  const { bus } = useKernel();
  const clean = useTintView((v) => v.clean);
  return (
    <>
      {TOOLS.map((tool) => (
        <ToolButton key={tool.key} tool={tool} />
      ))}
      <SideMenu />
      <HeaderRule />
      <SpaceChip />
      <ZoomChip />
      <HeaderRule />
      <IconButton
        label={
          clean
            ? "Leave the clean viewer (Esc)"
            : "Clean viewer: only the picture, full screen (Ctrl+F)"
        }
        active={clean}
        onClick={() => void bus.run(setClean, {})}
      >
        <Maximize2 />
      </IconButton>
    </>
  );
}

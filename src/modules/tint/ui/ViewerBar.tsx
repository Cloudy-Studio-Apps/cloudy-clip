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
import { useModule } from "@/core";
import { previewRef } from "@/modules/preview";
import { IconButton } from "@/ui";
import { HeaderRule } from "./HeaderRule";
import { SideMenu } from "./SideMenu";
import type { ViewerTool } from "./ui.types";
import { useTintView } from "./view.hook";
import { useTintSet } from "./view.set.hook";

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
  const on = preview || mine;
  const Icon = tool.icon;
  const toggle = () => {
    if (key === "compare") picture.setCompare(on ? null : 0.5);
    else if (key === "bypass") picture.setBypass(!on);
    else if (key === "samples") set({ samples: on ? null : [] });
    else set({ [key]: !on });
  };
  return (
    <IconButton label={tool.label} active={on} onClick={toggle}>
      <Icon />
    </IconButton>
  );
}

/** The viewer header's tool buttons, the color space and the zoom. */
export function ViewerBar() {
  const set = useTintSet();
  const clean = useTintView((v) => v.clean);
  return (
    <>
      {TOOLS.map((tool) => (
        <ToolButton key={tool.key} tool={tool} />
      ))}
      <SideMenu />
      <HeaderRule />
      <span
        title="Camera S-Log3, shown as Rec.709"
        className="rounded-xs bg-surface-sunken px-1.5 py-0.5 font-mono text-xs font-normal text-muted-foreground"
      >
        S-Log3 → 709
      </span>
      <span
        title="Fit to the viewer (Shift+Z)"
        className="ml-1 rounded-xs bg-surface-sunken px-1.5 py-0.5 font-mono text-xs font-normal text-muted-foreground"
      >
        44%
      </span>
      <HeaderRule />
      <IconButton
        label={
          clean
            ? "Leave the clean viewer (Esc)"
            : "Clean viewer: only the picture, full screen (Ctrl+F)"
        }
        active={clean}
        onClick={() => set({ clean: !clean })}
      >
        <Maximize2 />
      </IconButton>
    </>
  );
}

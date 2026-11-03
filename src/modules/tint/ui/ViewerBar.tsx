import {
  Columns2,
  Crosshair,
  Frame,
  Maximize2,
  Power,
  Rainbow,
  SquareSplitHorizontal,
  Zap,
} from "lucide-react";
import { IconButton } from "@/ui";
import { HeaderRule } from "./HeaderRule";
import type { ViewerTool } from "./ui.types";
import { useTintView } from "./view.hook";
import { useTintSet } from "./view.set.hook";

/** The viewer's tools, in groups: compare, inspect, then the clean viewer. */
const GROUPS: readonly (readonly ViewerTool[])[] = [
  [
    {
      key: "compare",
      icon: SquareSplitHorizontal,
      label: "Before / after: wipe between the original and the grade (\\)",
    },
    {
      key: "side",
      icon: Columns2,
      label: "Side by side: this clip next to another clip or a still",
    },
    { key: "bypass", icon: Power, label: "Bypass grades: see every clip with no grade (Shift+D)" },
  ],
  [
    {
      key: "samples",
      icon: Crosshair,
      label: "Sample points: hover to read a color, click to pin up to three",
    },
    {
      key: "falseColor",
      icon: Rainbow,
      label: "False color: brightness as colors, to find clipping and skin level",
    },
    { key: "warning", icon: Zap, label: "Clip warning: blown-out areas in magenta" },
    { key: "guides", icon: Frame, label: "Guides: safe areas for titles and action" },
  ],
];

function ToolButton({ tool }: { tool: ViewerTool }) {
  const key = tool.key;
  const on = useTintView((v) => (key === "side" ? false : v[key]));
  const set = useTintSet();
  const Icon = tool.icon;
  return (
    <IconButton
      label={tool.label}
      active={on}
      onClick={() => key !== "side" && set({ [key]: !on })}
    >
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
      {GROUPS.map((group, i) => (
        <span key={i} className="flex items-center">
          {i > 0 && <HeaderRule />}
          {group.map((tool) => (
            <ToolButton key={tool.key} tool={tool} />
          ))}
        </span>
      ))}
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

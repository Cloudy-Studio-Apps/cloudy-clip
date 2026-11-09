import { Maximize2, Power, SquareSplitHorizontal } from "lucide-react";
import { useStore } from "zustand";
import { useModule } from "@/core";
import { previewRef } from "@/modules/preview";
import { IconButton } from "@/ui";
import { HeaderRule } from "./HeaderRule";
import type { ViewerTool } from "./ui.types";
import { useTintView } from "./view.hook";
import { useTintSet } from "./view.set.hook";

/**
 * The viewer's live tools: before/after and bypass. Sample points, false color, clip warning,
 * guides and side by side come with the viewer's inspect tools.
 */
const TOOLS: readonly ViewerTool[] = [
  {
    key: "compare",
    icon: SquareSplitHorizontal,
    label: "Before / after: wipe between the original and the grade",
  },
  { key: "bypass", icon: Power, label: "Bypass grades: see every clip with no grade (Shift+D)" },
];

function ToolButton({ tool }: { tool: ViewerTool }) {
  const { picture } = useModule(previewRef);
  const key = tool.key;
  const on = useStore(picture.view, (v) => (key === "compare" ? v.compare !== null : v.bypass));
  const Icon = tool.icon;
  return (
    <IconButton
      label={tool.label}
      active={on}
      onClick={() =>
        key === "compare" ? picture.setCompare(on ? null : 0.5) : picture.setBypass(!on)
      }
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
      {TOOLS.map((tool) => (
        <ToolButton key={tool.key} tool={tool} />
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

import { PenLine } from "lucide-react";
import { useStore } from "zustand";
import { useModule } from "@/core";
import { IconButton } from "@/ui";
import { soundRef } from "../../sound.ref";

/**
 * The pen in the timeline's tools: Draw volume, the same tool as the transport's. A drag over a
 * lane draws on the clip's line, or on the track's when its line is in front (L). A click again
 * goes back to Select.
 */
export function DrawVolumeTool() {
  const sound = useModule(soundRef);
  const drawing = useStore(sound.view, (s) => s.tool === "draw");
  return (
    <IconButton
      label={drawing ? "Draw volume (click for Select)" : "Draw volume"}
      active={drawing}
      aria-pressed={drawing}
      onClick={() => sound.setTool(drawing ? "select" : "draw")}
    >
      <PenLine />
    </IconButton>
  );
}

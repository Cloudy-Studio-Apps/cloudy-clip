import { cn } from "@/ui";
import { TINT_LAYOUT } from "../tint.layout";
import { ClipStrip } from "./ClipStrip";
import { GradePanel } from "./GradePanel";
import { ScopesPanel } from "./scopes/ScopesPanel";
import { ToolsPanel } from "./ToolsPanel";
import { Viewer } from "./Viewer";
import { useTintView } from "./view.hook";

/**
 * The Tint page in layout D: the grade and the viewer on top, the clips in the middle, the tools
 * and the scopes at the bottom. Drawn from demo data; nothing here edits the project yet.
 */
export function TintPage() {
  const leader = useTintView((v) => v.mode === "leader");
  return (
    <div
      className="grid h-full gap-2 bg-background p-2"
      style={{
        gridTemplateRows: `minmax(0,1fr) ${TINT_LAYOUT.clipsHeight}px ${TINT_LAYOUT.lowerHeight}px`,
      }}
    >
      <div
        className={cn("grid min-h-0 gap-2 transition-[grid-template-columns] duration-200")}
        style={{
          gridTemplateColumns: leader
            ? "minmax(0,1.15fr) minmax(0,1fr)"
            : `${TINT_LAYOUT.gradeWidth}px minmax(0,1fr)`,
        }}
      >
        <GradePanel />
        <Viewer />
      </div>
      <ClipStrip />
      <div className="grid min-h-0 grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] gap-2">
        <ToolsPanel />
        <ScopesPanel />
      </div>
    </div>
  );
}

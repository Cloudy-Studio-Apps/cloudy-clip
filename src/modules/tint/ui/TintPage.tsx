import { useModule } from "@/core";
import { cn } from "@/ui";
import { tintRef } from "../tint.ref";
import { TINT_LAYOUT } from "../tint.layout";
import { ClipStrip } from "./ClipStrip";
import { GradePanel } from "./GradePanel";
import { ScopesPanel } from "./scopes/ScopesPanel";
import { TintUnavailable } from "./TintUnavailable";
import { ToolsPanel } from "./ToolsPanel";
import { Viewer } from "./Viewer";
import { useTintView } from "./view.hook";

/**
 * The Tint page in layout D: the grade and the viewer on top, the clips in the middle, the tools
 * and the scopes at the bottom. The viewer, the strip, the grade, the tools, the scopes and
 * playback are real. Without a GPU it says so instead.
 */
export function TintPage() {
  const { available } = useModule(tintRef);
  return available ? <TintFrame /> : <TintUnavailable />;
}

function TintFrame() {
  const leader = useTintView((v) => v.mode === "leader");
  return (
    <div
      className="grid h-full bg-background"
      style={{
        gap: TINT_LAYOUT.gutter,
        padding: TINT_LAYOUT.gutter,
        gridTemplateRows: `minmax(0,1fr) ${TINT_LAYOUT.clipsHeight}px ${TINT_LAYOUT.lowerHeight}px`,
      }}
    >
      <div
        className={cn("grid min-h-0 transition-[grid-template-columns] duration-200")}
        style={{
          gap: TINT_LAYOUT.gutter,
          gridTemplateColumns: leader
            ? TINT_LAYOUT.leaderColumns
            : `${TINT_LAYOUT.gradeWidth}px minmax(0,1fr)`,
        }}
      >
        <GradePanel />
        <Viewer />
      </div>
      <ClipStrip />
      <div
        className="grid min-h-0 grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]"
        style={{ gap: TINT_LAYOUT.gutter }}
      >
        <ToolsPanel />
        <ScopesPanel />
      </div>
    </div>
  );
}

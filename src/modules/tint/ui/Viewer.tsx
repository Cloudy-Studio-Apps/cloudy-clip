import { cn } from "@/ui";
import { CurrentNote } from "./CurrentNote";
import { HeaderGap } from "./HeaderGap";
import { TintPanel } from "./TintPanel";
import { ViewerBar } from "./ViewerBar";
import { ViewerFrame } from "./ViewerFrame";
import { ViewerTransport } from "./ViewerTransport";
import { useTintView } from "./view.hook";

/** The viewer: the preview's picture, graded, its tools, and the transport. Clean viewer fills the window (Ctrl+F, Esc: `tint.setClean`). */
export function Viewer() {
  const clean = useTintView((v) => v.clean);
  return (
    <TintPanel
      className={cn(clean && "fixed inset-0 z-50 rounded-none")}
      header={
        <>
          Viewer
          <CurrentNote />
          <HeaderGap />
          <ViewerBar />
        </>
      }
    >
      <ViewerFrame />
      <ViewerTransport />
    </TintPanel>
  );
}

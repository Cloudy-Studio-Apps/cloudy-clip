import { useEffect } from "react";
import { cn } from "@/ui";
import { CurrentNote } from "./CurrentNote";
import { HeaderGap } from "./HeaderGap";
import { TintPanel } from "./TintPanel";
import { ViewerBar } from "./ViewerBar";
import { ViewerFrame } from "./ViewerFrame";
import { ViewerTransport } from "./ViewerTransport";
import { useTintView } from "./view.hook";
import { useTintSet } from "./view.set.hook";

/** The viewer: the preview's picture, graded, its tools, and the transport. Clean viewer fills the window. */
export function Viewer() {
  const clean = useTintView((v) => v.clean);
  const set = useTintSet();
  useEffect(() => {
    if (!clean) return;
    const leave = (event: KeyboardEvent) => event.key === "Escape" && set({ clean: false });
    window.addEventListener("keydown", leave);
    return () => window.removeEventListener("keydown", leave);
  }, [clean, set]);
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

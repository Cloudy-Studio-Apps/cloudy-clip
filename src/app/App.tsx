import { useEffect } from "react";
import { ErrorBoundary, KernelProvider, type Kernel } from "@/core";
import { MediaLibrary } from "@/modules/media";
import { PreviewPanel } from "@/modules/preview";
import { TimelinePanel } from "@/modules/timeline";
import { Notifications } from "./Notifications";
import { installShortcuts } from "./shortcuts";

/** Editor layout: library and preview on top, timeline below. Each panel fails on its own. */
export function App({ kernel }: { kernel: Kernel }) {
  useEffect(() => installShortcuts(kernel), [kernel]);

  return (
    <KernelProvider kernel={kernel}>
      <div className="grid h-screen grid-rows-[minmax(0,3fr)_minmax(0,2fr)] bg-neutral-950 text-neutral-100">
        <div className="grid min-h-0 grid-cols-[minmax(260px,1fr)_minmax(0,2fr)] border-b border-neutral-800">
          <div className="min-h-0 border-r border-neutral-800">
            <ErrorBoundary name="Media">
              <MediaLibrary />
            </ErrorBoundary>
          </div>
          <div className="min-h-0">
            <ErrorBoundary name="Preview">
              <PreviewPanel />
            </ErrorBoundary>
          </div>
        </div>
        <div className="min-h-0">
          <ErrorBoundary name="Timeline">
            <TimelinePanel />
          </ErrorBoundary>
        </div>
      </div>
      <Notifications />
    </KernelProvider>
  );
}

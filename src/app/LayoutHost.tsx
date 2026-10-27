import { useMemo } from "react";
import { ErrorBoundary, layoutPanels, usePoint, type LayoutPanel, type LayoutSlot } from "@/core";

function Slot({ panels }: { panels: LayoutPanel[] }) {
  return (
    <>
      {panels.map(({ id, title, component: Panel }) => (
        <ErrorBoundary key={id} name={title}>
          <Panel />
        </ErrorBoundary>
      ))}
    </>
  );
}

/**
 * Places the panels modules contribute to `layoutPanels`: side and main on top, bottom below.
 * Each panel fails on its own.
 */
export function LayoutHost() {
  const panels = usePoint(layoutPanels);
  const bySlot = useMemo(() => {
    const sorted = [...panels].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const of = (slot: LayoutSlot) => sorted.filter((panel) => panel.slot === slot);
    return { side: of("side"), main: of("main"), bottom: of("bottom") };
  }, [panels]);

  return (
    <div className="grid h-screen grid-rows-[minmax(0,3fr)_minmax(0,2fr)] bg-neutral-950 text-neutral-100">
      {/* Explicit sizes (not content-based) so no panel's content can squeeze another. */}
      <div className="flex min-h-0 border-b border-neutral-800">
        <div className="min-h-0 w-[clamp(260px,30%,520px)] shrink-0 overflow-hidden border-r border-neutral-800">
          <Slot panels={bySlot.side} />
        </div>
        <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
          <Slot panels={bySlot.main} />
        </div>
      </div>
      <div className="min-h-0">
        <Slot panels={bySlot.bottom} />
      </div>
    </div>
  );
}

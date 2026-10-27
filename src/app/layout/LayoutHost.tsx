import { useLayoutEffect, useMemo, useRef } from "react";
import { layoutPanels, usePoint, type LayoutSlot } from "@/core";
import { TopBar } from "../top-bar/TopBar";
import type { ResizableArea } from "./layout.types";
import { LayoutRegion } from "./LayoutRegion";
import { clampSize, readPanelSizes, RESIZE_RULES } from "./layout.sizes";
import { PanelSlot } from "./PanelSlot";
import { ResizeHandle } from "./ResizeHandle";
import { SidePanels } from "./SidePanels";

/**
 * The editor layout: top bar; side panels (as rail tabs), the preview and the inspector; the
 * timeline below. Places the panels modules contribute to `layoutPanels`; each panel fails on
 * its own. The side panel, inspector and timeline can be resized by dragging their edges.
 * The 1px gaps over the border color draw the dividers.
 */
export function LayoutHost() {
  const gridRef = useRef<HTMLDivElement>(null);
  const panels = usePoint(layoutPanels);
  const bySlot = useMemo(() => {
    const sorted = [...panels].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const of = (slot: LayoutSlot) => sorted.filter((panel) => panel.slot === slot);
    return {
      side: of("side"),
      main: of("main"),
      inspector: of("inspector"),
      bottom: of("bottom"),
    };
  }, [panels]);

  // Restore the sizes of the last session before the first paint.
  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    for (const [area, size] of Object.entries(readPanelSizes())) {
      const rule = RESIZE_RULES[area as ResizableArea];
      grid.style.setProperty(rule.cssVar, `${clampSize(rule, size)}px`);
    }
  }, []);

  return (
    // Explicit track sizes (not content-based) so no panel's content can squeeze another.
    <div
      ref={gridRef}
      className="grid h-screen grid-cols-[var(--side-w,340px)_minmax(0,1fr)_var(--inspector-w,300px)] grid-rows-[44px_minmax(0,1fr)_var(--timeline-h,38vh)] gap-px bg-border text-foreground"
    >
      <TopBar className="col-span-3" />
      <LayoutRegion
        contentClassName="flex"
        handle={<ResizeHandle area="side" edge="right" gridRef={gridRef} />}
      >
        <SidePanels panels={bySlot.side} />
      </LayoutRegion>
      <LayoutRegion>
        <PanelSlot panels={bySlot.main} />
      </LayoutRegion>
      <LayoutRegion handle={<ResizeHandle area="inspector" edge="left" gridRef={gridRef} />}>
        <PanelSlot panels={bySlot.inspector} />
      </LayoutRegion>
      <LayoutRegion
        className="col-span-3"
        handle={<ResizeHandle area="timeline" edge="top" gridRef={gridRef} />}
      >
        <PanelSlot panels={bySlot.bottom} />
      </LayoutRegion>
    </div>
  );
}

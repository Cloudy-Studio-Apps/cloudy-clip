import { useMemo, useRef } from "react";
import { useStore } from "zustand";
import { useModule } from "@/core";
import { cn } from "@/ui";
import { MIN_PANEL_HEIGHT, PANEL_HEADER_WIDTH } from "../keyframe.layout";
import { keyframeRef } from "../keyframe.ref";
import { ClipGroup } from "./ClipGroup";
import { CurveGraph } from "./CurveGraph";
import { PanelPlayhead } from "./PanelPlayhead";
import { PanelToolbar } from "./PanelToolbar";
import { PresetStrip } from "./PresetStrip";
import { usePanelActions } from "./panel.actions.hook";
import { usePanelKeys } from "./panel.keys.hook";
import { usePanelRows } from "./panel.rows.hook";
import { usePanelScroll, usePanelWindow } from "./panel.scroll.hook";

/** Room kept for the ruler and the timeline's toolbar when the divider is dragged up, in px. */
const KEEP_ABOVE = 90;

/** The dock under the tracks: every selected clip with its keys, on the timeline's own scale. Nothing in Normal. */
export function KeyPanel() {
  const mode = useStore(useModule(keyframeRef).view, (s) => s.mode);
  return mode === "normal" ? null : <OpenPanel />;
}

function OpenPanel() {
  const { view } = useModule(keyframeRef);
  const root = useRef<HTMLDivElement>(null);
  const maximized = useStore(view, (s) => s.maximized);
  const panelHeight = useStore(view, (s) => s.panelHeight);
  const scope = useStore(view, (s) => s.scope);
  const curves = useStore(view, (s) => s.mode) === "curves";
  const selection = useStore(view, (s) => s.selection);
  const rows = usePanelRows();
  const scale = usePanelWindow(root);
  usePanelScroll(root);
  const actions = usePanelActions(rows, root);
  usePanelKeys(root, actions);
  const selectedIds = useMemo(
    () => new Set(selection.map((ref) => `${ref.clipId}|${ref.path}|${ref.keyId}`)),
    [selection],
  );

  // The divider moves the panel's height in the DOM and writes it once, on release.
  const drag = (down: React.PointerEvent<HTMLDivElement>) => {
    const panel = root.current;
    if (!panel) return;
    down.preventDefault();
    const handle = down.currentTarget;
    handle.setPointerCapture(down.pointerId);
    const startY = down.clientY;
    const startHeight = panel.offsetHeight;
    const most = Math.max(
      MIN_PANEL_HEIGHT,
      (panel.parentElement?.clientHeight ?? startHeight) - KEEP_ABOVE,
    );
    let height = startHeight;
    const move = (e: PointerEvent) => {
      height = Math.round(
        Math.min(most, Math.max(MIN_PANEL_HEIGHT, startHeight + startY - e.clientY)),
      );
      panel.style.height = `${height}px`;
    };
    const up = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
      handle.removeEventListener("pointercancel", up);
      view.setState({ panelHeight: height });
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
    handle.addEventListener("pointercancel", up);
  };

  return (
    <div
      ref={root}
      data-key-panel
      className={cn(
        "relative flex min-h-0 flex-col border-t border-border-strong bg-surface-sunken",
        maximized ? "flex-1" : "shrink-0",
      )}
      style={maximized ? undefined : { height: panelHeight }}
    >
      {!maximized && (
        <div
          role="separator"
          aria-orientation="horizontal"
          className="absolute inset-x-0 -top-1 z-20 h-2 cursor-row-resize"
          onPointerDown={drag}
        />
      )}
      <PanelToolbar rows={rows} actions={actions} />
      <div className="flex min-h-0 flex-1">
        <div
          className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden"
          style={curves ? { flex: `0 0 ${PANEL_HEADER_WIDTH}px` } : undefined}
        >
          <div className="relative flex min-h-full flex-col">
            {rows.length === 0 ? (
              <p className="px-3 py-2 text-sm text-subtle-foreground">
                {scope === "all" ? "No clip has keys yet." : "Select a clip that has keys."}
              </p>
            ) : (
              rows.map((entry) => (
                <ClipGroup
                  key={entry.clip.id}
                  entry={entry}
                  scale={scale}
                  selectedIds={selectedIds}
                  headersOnly={curves}
                />
              ))
            )}
            <div className="flex flex-1">
              <div
                className="shrink-0 border-r-[1.5px] border-border-strong bg-muted"
                style={{ width: PANEL_HEADER_WIDTH }}
              />
            </div>
            {!curves && (
              <div
                className="pointer-events-none absolute inset-y-0 right-0 overflow-hidden"
                style={{ left: PANEL_HEADER_WIDTH }}
              >
                <PanelPlayhead />
              </div>
            )}
          </div>
        </div>
        {curves && <CurveGraph rows={rows} />}
      </div>
      <PresetStrip />
    </div>
  );
}

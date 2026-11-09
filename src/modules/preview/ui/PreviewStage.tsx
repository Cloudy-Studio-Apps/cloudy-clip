import { useEffect, useRef } from "react";
import { useStore } from "zustand";
import { ErrorBoundary, useModule, usePoint } from "@/core";
import { previewOverlays } from "../preview.points";
import { previewRef } from "../preview.ref";
import { FieldGuide } from "./FieldGuide";
import { useStageLayout } from "./stage.layout.hook";
import { useStageNavigation } from "./stage.navigation.hook";
import { WipeLine } from "./WipeLine";

interface PreviewStageProps {
  /**
   * Only the picture, fitted 22 px in from the edges, with the field guide over it: no overlays
   * (so no canvas tools), and the viewer's zoom and pan neither apply nor change. For a page's
   * own small preview.
   */
  bare?: boolean;
}

/**
 * The dark stage around the frame. The frame (canvas + overlays) is placed imperatively from the
 * viewer's zoom and pan, so zooming and panning cause no React renders.
 * Ctrl + wheel zooms, wheel or middle-drag pans. While comparing, the wipe line sits over the frame.
 *
 * Only the newest mounted stage is drawn on (`attachCanvas`): a page that mounts its own takes the
 * frames while it is open, and the editor's stage gets them back when it closes.
 */
export function PreviewStage({ bare = false }: PreviewStageProps) {
  const preview = useModule(previewRef);
  const overlays = usePoint(previewOverlays);
  const stageRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const comparing = useStore(preview.picture.view, (s) => s.compare !== null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    return preview.attachCanvas(canvas);
  }, [preview]);

  useStageLayout(stageRef, frameRef, canvasRef, !bare);
  useStageNavigation(stageRef, !bare);

  return (
    <div ref={stageRef} className="relative min-h-0 flex-1 overflow-hidden bg-stage">
      {/* Absolutely positioned and sized from the stage, so it can never resize the stage
          (which would feed back into the ResizeObserver). */}
      <div ref={frameRef} className="absolute left-1/2 top-1/2 will-change-transform">
        <canvas
          ref={canvasRef}
          className="block size-full bg-black shadow-[0_0_0_1px_var(--border-strong)]"
        />
        {bare && <FieldGuide />}
        {!bare &&
          overlays.map(({ id, component: Overlay }) => (
            <div key={id} className="pointer-events-none absolute inset-0">
              <ErrorBoundary name={id}>
                <Overlay />
              </ErrorBoundary>
            </div>
          ))}
        {comparing && <WipeLine />}
      </div>
    </div>
  );
}

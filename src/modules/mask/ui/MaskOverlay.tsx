import { useEffect, useMemo } from "react";
import { useStore } from "zustand";
import { notify, useKernel, useModule } from "@/core";
import { inspectorRef, useClipAtPlayhead } from "@/modules/inspector";
import {
  MARKER_HEX,
  maskOutline,
  orderedMasks,
  projectRef,
  useOpenFormat,
  type Clip,
  type MaskId,
} from "@/modules/project";
import { transformRef, useVisibleLayers, type VisibleLayer } from "@/modules/transform";
import { cn } from "@/ui";
import { frameMapping, invertible } from "../logic/mapping";
import { removeMasks } from "../mask.commands";
import { maskRef } from "../mask.ref";
import { useMaskEdit } from "./mask.edit.hook";
import { isTextField, outlineData } from "./mask.paint";
import { useMaskClip } from "./mask.subject.hook";
import { MaskBox } from "./MaskBox";
import { MaskPathPoints } from "./MaskPathPoints";

/**
 * The selected clip's masks over the frame (DOM only, never in a capture or export), while the
 * Mask tab is open or one of them is selected: every mask outlined in its color (dashed when off),
 * a press on one selects it, and the selected one is editable. While a mask is selected the
 * transform box hides; Escape or a press on empty space deselects it, and Delete removes it (or its
 * selected point, which `MaskPathPoints` handles) instead of reaching the timeline's clip.
 */
export function MaskOverlay() {
  const { bus } = useKernel();
  const { ui } = useModule(maskRef);
  const transform = useModule(transformRef);
  const inspector = useModule(inspectorRef);
  const project = useModule(projectRef).store;
  const clip = useMaskClip();
  const chosen = useStore(ui, (s) => s.selectedMaskId);
  const drawing = useStore(ui, (s) => s.drawing !== null);
  const tab = useStore(inspector.view.store, (s) => (clip ? s.tabs[clip.kind] : undefined));
  const selected = chosen !== null && clip?.masks?.[chosen] ? chosen : null;

  // A mask stays selected only while its clip is the one selected.
  const clipId = clip?.id;
  useEffect(() => () => ui.setState({ selectedMaskId: null, selectedPointId: null }), [clipId, ui]);

  useEffect(() => {
    if (!selected) return;
    transform.hideBox("mask", true);
    // Bubble phase: a drag's own Escape (capture) stops it before it gets here.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || isTextField(e.target)) return;
      ui.setState({ selectedMaskId: null, selectedPointId: null });
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      transform.hideBox("mask", false);
    };
  }, [selected, transform, ui]);

  useEffect(() => {
    if (!selected || clipId === undefined) return;
    // Capture phase, before the timeline's Delete takes the clip that holds the mask.
    const onDelete = (e: KeyboardEvent) => {
      if ((e.key !== "Delete" && e.key !== "Backspace") || isTextField(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      const shape = project.getState().clips[clipId]?.masks?.[selected]?.shape;
      const point = ui.getState().selectedPointId;
      if (shape?.kind === "path" && point && shape.pointOrder.includes(point)) return;
      ui.setState({ selectedMaskId: null, selectedPointId: null });
      void bus.run(removeMasks, { clipId, maskIds: [selected] }).then((result) => {
        if (!result.ok) notify("error", result.error.message);
      });
    };
    window.addEventListener("keydown", onDelete, true);
    return () => window.removeEventListener("keydown", onDelete, true);
  }, [bus, clipId, project, selected, ui]);

  if (!clip || drawing || (tab !== "mask" && !selected)) return null;
  return <MaskLayer clip={clip} selectedId={selected} />;
}

interface MaskLayerProps {
  clip: Clip;
  selectedId: MaskId | null;
}

/** The clip's layer at the playhead; mounted only while the overlay shows, as it follows every frame. */
function MaskLayer({ clip, selectedId }: MaskLayerProps) {
  const layer = useVisibleLayers().find((l) => l.clipId === clip.id);
  return layer ? <MaskCanvas clip={clip} layer={layer} selectedId={selectedId} /> : null;
}

interface MaskCanvasProps {
  clip: Clip;
  layer: VisibleLayer;
  selectedId: MaskId | null;
}

/** The outlines at the playhead in the clip's mapping, and the selected mask's editor. */
function MaskCanvas({ clip, layer, selectedId }: MaskCanvasProps) {
  const { ui } = useModule(maskRef);
  const format = useOpenFormat();
  const now = useClipAtPlayhead(clip);
  const edit = useMaskEdit(clip.id);
  const mapping = useMemo(
    () => frameMapping(format, layer.source, layer.transform),
    [format, layer.source, layer.transform],
  );
  if (!invertible(mapping)) return null;

  const masks = orderedMasks(now);
  const selected = masks.find((m) => m.id === selectedId);
  const select = (e: React.PointerEvent, maskId: MaskId | null) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    ui.setState({ selectedMaskId: maskId, selectedPointId: null });
  };
  const { width, height } = format;
  return (
    <div
      data-mask-overlay
      className={cn("absolute inset-0", selected ? "pointer-events-auto" : "pointer-events-none")}
      onPointerDown={(e) => select(e, null)}
    >
      <svg
        className="pointer-events-none absolute inset-0 size-full overflow-visible"
        viewBox={`${-width / 2} ${-height / 2} ${width} ${height}`}
        preserveAspectRatio="none"
      >
        {masks
          .filter((m) => m !== selected)
          .map((m) => (
            <path
              key={m.id}
              d={outlineData(m, mapping, format)}
              fill={maskOutline(m) ? "transparent" : "none"}
              stroke={MARKER_HEX[m.color]}
              strokeWidth={1.5}
              strokeDasharray={m.on === false ? "4 3" : undefined}
              vectorEffect="non-scaling-stroke"
              className="cursor-pointer"
              style={{ pointerEvents: "visiblePainted" }}
              onPointerDown={(e) => select(e, m.id)}
            >
              <title>{m.name}</title>
            </path>
          ))}
      </svg>
      {selected?.shape.kind === "path" && (
        <MaskPathPoints
          clipId={clip.id}
          mask={selected}
          mapping={mapping}
          format={format}
          edit={edit}
        />
      )}
      {selected && selected.shape.kind !== "path" && (
        <MaskBox mask={selected} mapping={mapping} format={format} edit={edit} />
      )}
    </div>
  );
}

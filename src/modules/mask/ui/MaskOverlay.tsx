import { useEffect, useMemo } from "react";
import { useStore } from "zustand";
import { useModule } from "@/core";
import { inspectorRef, useClipAtPlayhead } from "@/modules/inspector";
import {
  MARKER_HEX,
  maskOutline,
  orderedMasks,
  useOpenFormat,
  type Clip,
  type MaskId,
} from "@/modules/project";
import { transformRef, type VisibleLayer } from "@/modules/transform";
import { cn } from "@/ui";
import { frameMapping, invertible } from "../logic/mapping";
import { maskRef } from "../mask.ref";
import { useMaskEdit } from "./mask.edit.hook";
import { isTextField, outlineData } from "./mask.paint";
import { useMaskSubject } from "./mask.subject.hook";
import { MaskBox } from "./MaskBox";
import { MaskPathPoints } from "./MaskPathPoints";

/**
 * The selected clip's masks over the frame (DOM only, never in a capture or export), while the
 * Mask tab is open or one of them is selected: every mask outlined in its color (dashed when off),
 * a press on one selects it, and the selected one is editable. While a mask is selected the
 * transform box hides; Escape or a press on empty space deselects it.
 */
export function MaskOverlay() {
  const { ui } = useModule(maskRef);
  const transform = useModule(transformRef);
  const inspector = useModule(inspectorRef);
  const { clip, layer } = useMaskSubject();
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

  if (!clip || !layer || drawing || (tab !== "mask" && !selected)) return null;
  return <MaskCanvas clip={clip} layer={layer} selectedId={selected} />;
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

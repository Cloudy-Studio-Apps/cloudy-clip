import { useEffect, useState } from "react";
import { useModule } from "@/core";
import { fontsRef } from "@/modules/fonts";
import { mediaRef } from "@/modules/media";
import { previewRef } from "@/modules/preview";
import { canvasTextMeasure, elementRef } from "@/modules/element";
import { projectRef, type MediaId, type PictureSize } from "@/modules/project";
import { visibleLayers } from "../logic/layers";
import type { VisibleLayer } from "../transform.types";

const keyOf = (layers: readonly VisibleLayer[]) =>
  layers.map((l) => `${l.clipId}:${l.source.width}x${l.source.height}`).join("|");

/**
 * Pictures (video and text) on screen at the playhead, top-most first. Recomputed on every playhead move,
 * project change, probe change and font load, but React re-renders only when the list itself changes
 * (at cuts), never per frame.
 */
export function useVisibleLayers(): VisibleLayer[] {
  const project = useModule(projectRef).store;
  const media = useModule(mediaRef);
  const fonts = useModule(fontsRef);
  const elements = useModule(elementRef);
  const { playback, textClipOverride, onTextOverride } = useModule(previewRef);
  const [layers, setLayers] = useState<VisibleLayer[]>([]);

  useEffect(() => {
    const sizeOf = (id: MediaId): PictureSize | undefined => {
      const probe = media.getProbe(id);
      return probe?.width && probe.height
        ? { width: probe.width, height: probe.height }
        : undefined;
    };
    // Text is measured like the engine draws it (a 2D canvas with the same font).
    const measure = canvasTextMeasure(document.createElement("canvas").getContext("2d"));
    let lastKey: string | null = null;
    const update = () => {
      const next = visibleLayers(
        project.getState(),
        elements,
        sizeOf,
        playback.getTime(),
        measure,
        textClipOverride,
      );
      const key = keyOf(next);
      if (key === lastKey) return;
      lastKey = key;
      setLayers(next);
    };
    const offTime = playback.onTime(update);
    const offProject = project.subscribe(update);
    const offOverride = onTextOverride(update);
    const offProbes = media.probes.subscribe(update);
    // A font that arrives changes the text's size: measure again so the box matches the picture.
    const offFonts = fonts.onLoaded(update);
    return () => {
      offTime();
      offProject();
      offProbes();
      offOverride();
      offFonts();
    };
  }, [elements, fonts, media, playback, project, textClipOverride, onTextOverride]);

  return layers;
}

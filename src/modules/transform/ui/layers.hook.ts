import { useEffect, useState } from "react";
import { useModule } from "@/core";
import { mediaRef } from "@/modules/media";
import { previewRef } from "@/modules/preview";
import { projectRef, type MediaId, type PictureSize } from "@/modules/project";
import { visibleLayers } from "../logic/layers";
import type { VisibleLayer } from "../transform.types";

const keyOf = (layers: readonly VisibleLayer[]) =>
  layers.map((l) => `${l.clipId}:${l.source.width}x${l.source.height}`).join("|");

/**
 * Video layers on screen at the playhead, top-most first. Recomputed on every playhead move,
 * project change and probe change, but React re-renders only when the list itself changes
 * (at cuts), never per frame.
 */
export function useVisibleLayers(): VisibleLayer[] {
  const project = useModule(projectRef).store;
  const media = useModule(mediaRef);
  const { playback } = useModule(previewRef);
  const [layers, setLayers] = useState<VisibleLayer[]>([]);

  useEffect(() => {
    const sizeOf = (id: MediaId): PictureSize | undefined => {
      const probe = media.getProbe(id);
      return probe?.width && probe.height
        ? { width: probe.width, height: probe.height }
        : undefined;
    };
    let lastKey: string | null = null;
    const update = () => {
      const next = visibleLayers(project.getState(), sizeOf, playback.getTime());
      const key = keyOf(next);
      if (key === lastKey) return;
      lastKey = key;
      setLayers(next);
    };
    const offTime = playback.onTime(update);
    const offProject = project.subscribe(update);
    const offProbes = media.probes.subscribe(update);
    return () => {
      offTime();
      offProject();
      offProbes();
    };
  }, [media, playback, project]);

  return layers;
}

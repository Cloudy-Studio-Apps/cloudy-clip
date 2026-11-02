import { useEffect, useRef } from "react";
import { useKernel } from "@/core";
import type { BinId } from "@/modules/project";
import { moveToBin } from "../media.bin.commands";
import { MEDIA_DROP } from "../media.drag";
import type { MediaDragDetail } from "../media.types";

/** Makes an element take files dragged onto it into a bin. Null is Master. */
export function useBinDrop(binId: BinId | null) {
  const { bus } = useKernel();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const target = ref.current;
    if (!target) return;
    const onDrop = (event: Event) => {
      const { item } = (event as CustomEvent<MediaDragDetail>).detail;
      if (item.type !== "media") return;
      event.stopPropagation();
      void bus.run(moveToBin, { mediaIds: [item.id], binId });
    };
    target.addEventListener(MEDIA_DROP, onDrop);
    return () => target.removeEventListener(MEDIA_DROP, onDrop);
  }, [bus, binId]);
  return ref;
}

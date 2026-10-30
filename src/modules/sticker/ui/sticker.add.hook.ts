import { useCallback } from "react";
import { useKernel, useModule } from "@/core";
import { projectRef } from "@/modules/project";
import { startCreateDrag, timelineRef } from "@/modules/timeline";
import { addSticker } from "../sticker.commands";
import { stickerRef } from "../sticker.ref";
import type { StickerHit } from "../sticker.types";

/**
 * The press of a sticker tile: a click adds the sticker at the playhead, a drag drops it on the
 * timeline (on the lane under the pointer when it may sit there). What gets added goes to the
 * recently used list.
 */
export function useStickerPress(): (event: PointerEvent, hit: StickerHit) => void {
  const { bus } = useKernel();
  const stickers = useModule(stickerRef);
  const timeline = useModule(timelineRef);
  const project = useModule(projectRef).store;

  return useCallback(
    (event, { pack, sticker }) => {
      const add = async (at: { start?: number; trackId?: string }) => {
        const result = await bus.run(addSticker, { pack, sticker: sticker.id, ...at });
        if (result.ok) stickers.recents.push({ pack, sticker: sticker.id });
      };
      startCreateDrag(event, sticker.label, {
        onClick: () => void add({}),
        onDrop(x, y) {
          const target = timeline.dropTarget(x, y);
          if (!target) return;
          const fits = project.getState().tracks[target.trackId]?.kind === "video";
          void add({ start: target.time, ...(fits && { trackId: target.trackId }) });
        },
      });
    },
    [bus, stickers, timeline, project],
  );
}

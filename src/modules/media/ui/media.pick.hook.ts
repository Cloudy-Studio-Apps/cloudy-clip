import { open } from "@tauri-apps/plugin-dialog";
import { useCallback } from "react";
import { useKernel, useModule } from "@/core";
import { importMedia } from "../media.commands";
import { mediaRef } from "../media.ref";
import type { LibraryPlace } from "../media.types";
import {
  ACCEPTED_EXTENSIONS,
  AUDIO_EXTENSIONS,
  IMAGE_EXTENSIONS,
  VIDEO_EXTENSIONS,
} from "../media.service";

/** The bin new files land in. */
function openBin(place: LibraryPlace): string | undefined {
  return place.kind === "bin" ? (place.binId ?? undefined) : undefined;
}

/** Opens the system file picker, at `defaultPath` if given, and imports into the open bin. */
export function usePickMedia(): (options?: { defaultPath?: string }) => Promise<void> {
  const { bus } = useKernel();
  const { view } = useModule(mediaRef);
  return useCallback(
    async (options) => {
      const selected = await open({
        multiple: true,
        directory: false,
        defaultPath: options?.defaultPath,
        filters: [
          { name: "All media", extensions: ACCEPTED_EXTENSIONS },
          { name: "Video", extensions: VIDEO_EXTENSIONS },
          { name: "Audio", extensions: AUDIO_EXTENSIONS },
          { name: "Images", extensions: IMAGE_EXTENSIONS },
        ],
      });
      if (selected && selected.length > 0) {
        await bus.run(importMedia, { paths: selected, binId: openBin(view.getState().place) });
      }
    },
    [bus, view],
  );
}

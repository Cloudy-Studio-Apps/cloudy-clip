import { open } from "@tauri-apps/plugin-dialog";
import { useCallback } from "react";
import { useKernel } from "@/core";
import { importMedia } from "../media.commands";
import {
  ACCEPTED_EXTENSIONS,
  AUDIO_EXTENSIONS,
  IMAGE_EXTENSIONS,
  VIDEO_EXTENSIONS,
} from "../media.service";

/** Opens the system file picker and imports what the user chose. */
export function usePickMedia(): () => Promise<void> {
  const { bus } = useKernel();
  return useCallback(async () => {
    const selected = await open({
      multiple: true,
      directory: false,
      filters: [
        { name: "All media", extensions: ACCEPTED_EXTENSIONS },
        { name: "Video", extensions: VIDEO_EXTENSIONS },
        { name: "Audio", extensions: AUDIO_EXTENSIONS },
        { name: "Images", extensions: IMAGE_EXTENSIONS },
      ],
    });
    if (selected && selected.length > 0) await bus.run(importMedia, { paths: selected });
  }, [bus]);
}

import { open } from "@tauri-apps/plugin-dialog";
import type { CommandBus } from "@/core";
import { importMedia } from "../media.commands";
import {
  ACCEPTED_EXTENSIONS,
  AUDIO_EXTENSIONS,
  IMAGE_EXTENSIONS,
  VIDEO_EXTENSIONS,
} from "../media.service";
import type { MediaApi } from "../media.types";

/** Opens the system file picker, at `defaultPath` if given, and imports into the open bin. */
export async function pickMedia(
  bus: CommandBus,
  view: MediaApi["view"],
  options?: { defaultPath?: string },
): Promise<void> {
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
  if (!selected || selected.length === 0) return;
  const { place } = view.getState();
  const binId = place.kind === "bin" ? (place.binId ?? undefined) : undefined;
  await bus.run(importMedia, { paths: selected, binId });
}

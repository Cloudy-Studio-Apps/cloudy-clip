import { dirname, join } from "@tauri-apps/api/path";
import { open } from "@tauri-apps/plugin-dialog";
import { useCallback } from "react";
import { useKernel, useModule } from "@/core";
import { projectRef, type MediaAsset } from "@/modules/project";
import { relinkMedia } from "../media.commands";
import { mediaRef } from "../media.ref";
import { ACCEPTED_EXTENSIONS, statFile } from "../media.service";

/** The file's own name: the library's can be another. */
const fileNameOf = (path: string) => path.split(/[\\/]/).pop() ?? path;

/**
 * Asks where a missing file went and points the media at it. The other missing files are looked
 * for in the same folder, as files usually move together.
 */
export function useLocateMedia(): (asset: MediaAsset) => Promise<void> {
  const { bus } = useKernel();
  const media = useModule(mediaRef);
  const { store } = useModule(projectRef);
  return useCallback(
    async (asset) => {
      const path = await open({
        multiple: false,
        directory: false,
        title: `Locate ${asset.name}`,
        filters: [{ name: "Media", extensions: ACCEPTED_EXTENSIONS }],
      });
      if (!path) return;
      const result = await bus.run(relinkMedia, { mediaId: asset.id, path });
      if (!result.ok) return;
      const folder = await dirname(path);
      for (const other of Object.values(store.getState().media)) {
        if (other.id === asset.id || media.getProbe(other.id)?.status !== "missing") continue;
        const candidate = await join(folder, fileNameOf(other.path));
        const found = await statFile(candidate).catch(() => null);
        if (found) await bus.run(relinkMedia, { mediaId: other.id, path: candidate });
      }
    },
    [bus, media, store],
  );
}

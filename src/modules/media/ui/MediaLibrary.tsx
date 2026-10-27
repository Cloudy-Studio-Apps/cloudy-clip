import { open } from "@tauri-apps/plugin-dialog";
import { useStore } from "zustand";
import { useKernel, useModule } from "@/core";
import { projectRef } from "@/modules/project";
import { importMedia } from "../media.commands";
import { ACCEPTED_EXTENSIONS } from "../media.service";
import { mediaRef } from "../media.ref";
import { MediaTile } from "./MediaTile";

/** The media library panel: import files and drag them onto the timeline. */
export function MediaLibrary() {
  const project = useModule(projectRef).store;
  const { bus } = useKernel();
  const mediaOrder = useStore(project.api, (s) => s.mediaOrder);
  const media = useStore(project.api, (s) => s.media);
  const dropActive = useStore(useModule(mediaRef).fileDrop, (s) => s.active);

  async function pickFiles() {
    const selected = await open({
      multiple: true,
      directory: false,
      filters: [{ name: "Media", extensions: ACCEPTED_EXTENSIONS }],
    });
    if (selected && selected.length > 0) await bus.run(importMedia, { paths: selected });
  }

  return (
    <section className="relative flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-neutral-800 px-3 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Media</h2>
        <button
          type="button"
          className="rounded bg-sky-600 px-3 py-1 text-xs font-medium text-white hover:bg-sky-500"
          onClick={() => void pickFiles()}
        >
          Import
        </button>
      </header>

      {mediaOrder.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-1 p-6 text-center text-sm text-neutral-500">
          <p>Drop video or audio files here</p>
          <p className="text-xs">or use Import</p>
        </div>
      ) : (
        <div className="grid flex-1 auto-rows-min grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2 overflow-y-auto p-3">
          {mediaOrder.map((id) => {
            const asset = media[id];
            return asset ? <MediaTile key={id} asset={asset} /> : null;
          })}
        </div>
      )}

      {dropActive && (
        <div className="pointer-events-none absolute inset-2 flex items-center justify-center rounded-lg border-2 border-dashed border-sky-500 bg-sky-500/10 text-sm text-sky-300">
          Drop to import
        </div>
      )}
    </section>
  );
}

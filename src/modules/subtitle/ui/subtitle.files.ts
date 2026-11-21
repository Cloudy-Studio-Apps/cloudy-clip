import { LOCAL_ACTOR, notify, type Kernel } from "@/core";
import { projectRef } from "@/modules/project";
import { toSrt } from "../logic/srt";
import { importSubtitles } from "../subtitle.import.command";
import { pickSubtitleFile, readSubtitleFile, saveSrt } from "../subtitle.service";
import { report } from "@/core";

/** The file's name without folder or extension, for the new tracks (at most 50 characters). */
const baseName = (path: string) =>
  (path.split(/[\\/]/).pop() ?? "").replace(/\.[^.]+$/, "").slice(0, 50) || undefined;

/** Asks for an `.srt` / `.vtt` file and reads it into the open composition, saying how it went. */
export async function importFile(kernel: Kernel): Promise<void> {
  try {
    const path = await pickSubtitleFile();
    if (!path) return;
    const text = await readSubtitleFile(path);
    const format = path.toLowerCase().endsWith(".vtt") ? "vtt" : "srt";
    const done = report(
      await kernel.bus.run(importSubtitles, { text, format, name: baseName(path) }),
    );
    if (!done) return;
    const skipped = done.skipped > 0 ? `, ${done.skipped} skipped` : "";
    notify("success", `Imported ${done.clipIds.length} cues${skipped}`);
  } catch (error) {
    notify("error", `Couldn't read the file: ${String(error)}`);
  }
}

/** Asks where to save the open composition's cues as `.srt` and writes them. */
export async function exportFile(kernel: Kernel): Promise<void> {
  const project = kernel.modules.require(projectRef);
  const id = project.view.openFor(LOCAL_ACTOR);
  const composition = id === null ? undefined : project.store.getState().compositions[id];
  if (!composition) return;
  const text = toSrt(project.store.getState(), composition.id);
  if (!text) {
    notify("info", "No subtitles to export yet");
    return;
  }
  try {
    const path = await saveSrt(text, composition.name);
    if (path) notify("success", `Saved ${path.split(/[\\/]/).pop()}`);
  } catch (error) {
    notify("error", `Couldn't save the file: ${String(error)}`);
  }
}

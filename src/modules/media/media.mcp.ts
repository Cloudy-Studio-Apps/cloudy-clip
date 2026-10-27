import { z } from "zod";
import { commandTool, defineMcpTool, errorResult, textResult } from "@/core";
import { projectStore, type MediaAsset } from "@/modules/project";
import { importMedia, removeMedia } from "./media.commands";
import { getProbe, waitForProbe } from "./media.store";
import type { ImportResult } from "./media.types";

/** Media as agents see it: identity plus metadata (no poster blob URLs). */
function describe(asset: MediaAsset) {
  const probe = getProbe(asset.id);
  return {
    ...asset,
    status: probe?.status ?? "pending",
    duration: probe?.duration,
    width: probe?.width,
    height: probe?.height,
    error: probe?.error,
    proxy: probe?.proxy,
  };
}

const importTool = defineMcpTool({
  name: "media_import",
  description:
    'Imports local video/audio files by absolute path and waits (up to 15 s) until their metadata (duration in microseconds, size) is read. Pro formats (ProRes, APV, 10-bit HEVC...) first get an editing proxy, which can take longer: if status is still "pending", poll media_list until it is "ready". Returns each imported item with its id, plus files that failed.',
  input: importMedia.input,
  async handler(input, { bus }) {
    const result = await bus.run(importMedia, input, { origin: "agent" });
    if (!result.ok) return errorResult(result.error);
    const value: ImportResult = result.value;
    await Promise.all(value.imported.map((asset) => waitForProbe(asset.id)));
    return textResult({ imported: value.imported.map(describe), failed: value.failed });
  },
});

const listTool = defineMcpTool({
  name: "media_list",
  description:
    "Lists imported media with metadata: kind, duration (microseconds), width/height, status (pending, ready, error), and proxy (state, progress 0..1, message) for files being optimized for editing.",
  input: z.object({}),
  handler() {
    const state = projectStore.getState();
    return textResult(
      state.mediaOrder.flatMap((id) => {
        const asset = state.media[id];
        return asset ? [describe(asset)] : [];
      }),
    );
  },
});

export const mediaMcpTools = [
  importTool,
  listTool,
  commandTool(removeMedia, { name: "media_remove" }),
];

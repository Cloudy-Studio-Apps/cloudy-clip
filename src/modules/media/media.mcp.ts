import { z } from "zod";
import { commandTool, defineMcpTool, errorResult, textResult } from "@/core";
import { projectRef, type MediaAsset } from "@/modules/project";
import { importMedia, relinkMedia, removeMedia } from "./media.commands";
import { mediaRef } from "./media.ref";
import type { ImportResult, MediaApi } from "./media.types";

/** Media as agents see it: identity plus metadata (no poster blob URLs). */
function describe(media: MediaApi, asset: MediaAsset) {
  const probe = media.getProbe(asset.id);
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
  async handler(input, { bus, require }) {
    const media = require(mediaRef);
    const result = await bus.run(importMedia, input);
    if (!result.ok) return errorResult(result.error);
    const value: ImportResult = result.value;
    await Promise.all(value.imported.map((asset) => media.waitForProbe(asset.id)));
    return textResult({
      imported: value.imported.map((asset) => describe(media, asset)),
      failed: value.failed,
    });
  },
});

const listTool = defineMcpTool({
  name: "media_list",
  readOnly: true,
  description:
    "Lists imported media with metadata: kind, duration (microseconds), width/height, status (pending, ready, error, or missing when the file is not where the project says: fix it with media_relink), and proxy (state, progress 0..1, message) for files being optimized for editing.",
  input: z.object({}),
  handler(_input, { require }) {
    const media = require(mediaRef);
    const state = require(projectRef).store.getState();
    return textResult(
      state.mediaOrder.flatMap((id) => {
        const asset = state.media[id];
        return asset ? [describe(media, asset)] : [];
      }),
    );
  },
});

export const mediaMcpTools = [
  importTool,
  listTool,
  commandTool(removeMedia, { name: "media_remove" }),
  commandTool(relinkMedia, { name: "media_relink" }),
];

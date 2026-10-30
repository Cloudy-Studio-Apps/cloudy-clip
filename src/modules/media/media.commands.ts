import { z } from "zod";
import { CommandFailure, createId, defineCommand } from "@/core";
import { isMediaInUse, type MediaAsset, projectRef } from "@/modules/project";
import { registerFiles, statFile } from "./media.service";
import type { ImportResult } from "./media.types";

/**
 * Imports local files. Each file is validated natively; bad files are reported in `failed`
 * without failing the others. Metadata is read in the background (see `media_list`).
 */
export const importMedia = defineCommand({
  id: "media.import",
  label: "Import media",
  description:
    "Imports local video, audio or image files by absolute path. Returns the imported media (with ids) and the files that failed.",
  undoable: true,
  input: z.object({ paths: z.array(z.string().min(1)).min(1).max(200) }),
  async run(ctx, { paths }): Promise<ImportResult> {
    const outcomes = await registerFiles(paths.map((path) => ({ id: createId("media"), path })));
    const imported: MediaAsset[] = [];
    const failed: ImportResult["failed"] = [];
    for (const outcome of outcomes) {
      if (outcome.status === "ok") imported.push(outcome.media);
      else failed.push({ path: outcome.path, reason: outcome.error.message });
    }
    if (imported.length > 0) {
      ctx.mutate(ctx.require(projectRef).store, (draft) => {
        for (const asset of imported) {
          draft.media[asset.id] = asset;
          draft.mediaOrder.push(asset.id);
        }
      });
    }
    if (imported.length === 0 && failed.length > 0) {
      throw new CommandFailure(
        "media.import_failed",
        failed.map((f) => `${f.path}: ${f.reason}`).join("; "),
        failed,
      );
    }
    return { imported, failed };
  },
});

/** Removes a media item from the library. Refuses while clips still use it. */
export const removeMedia = defineCommand({
  id: "media.remove",
  label: "Remove media",
  description: "Removes an imported media item from the library. Fails if any clip still uses it.",
  undoable: true,
  input: z.object({ mediaId: z.string() }),
  run(ctx, { mediaId }) {
    const state = ctx.require(projectRef).store.getState();
    if (!state.media[mediaId]) {
      throw new CommandFailure("media.not_found", `No media with id "${mediaId}"`);
    }
    if (isMediaInUse(state, mediaId)) {
      throw new CommandFailure(
        "media.in_use",
        "This media is used by clips on the timeline. Delete those clips first.",
      );
    }
    ctx.mutate(ctx.require(projectRef).store, (draft) => {
      delete draft.media[mediaId];
      draft.mediaOrder = draft.mediaOrder.filter((id) => id !== mediaId);
    });
  },
});

/**
 * Points a media item at another file, keeping its clips: for a file that moved. The module
 * follows the path in the document, so undo and redo move the stream too.
 */
export const relinkMedia = defineCommand({
  id: "media.relink",
  label: "Locate media",
  description:
    'Points a media item at the file at an absolute path, keeping its clips. Use it for media with status "missing". Fails with media.not_found, or media.wrong_kind when the new file is a different kind (audio for video, an image for either).',
  undoable: true,
  input: z.object({ mediaId: z.string(), path: z.string().min(1) }),
  async run(ctx, { mediaId, path }) {
    const { store } = ctx.require(projectRef);
    const asset = store.getState().media[mediaId];
    if (!asset) throw new CommandFailure("media.not_found", `No media with id "${mediaId}"`);
    const file = await statFile(path).catch((error: { message?: string }) => {
      throw new CommandFailure("media.not_found", error.message ?? `File not found: ${path}`);
    });
    if (file.kind !== asset.kind) {
      throw new CommandFailure(
        "media.wrong_kind",
        `${asset.name} is ${asset.kind}, and ${file.name} is ${file.kind}.`,
      );
    }
    ctx.mutate(store, (draft) => {
      const target = draft.media[mediaId];
      if (target) Object.assign(target, { path, name: file.name, size: file.size });
    });
  },
});

export const mediaCommands = [importMedia, removeMedia, relinkMedia];

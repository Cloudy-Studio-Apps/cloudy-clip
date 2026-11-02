import { z } from "zod";
import { CommandFailure, defineCommand } from "@/core";
import { projectRef, type MediaInfo, type ProjectState } from "@/modules/project";

const text = z.string().max(2000).nullable().optional();

function requireMedia(state: ProjectState, mediaId: string): void {
  if (!state.media[mediaId]) {
    throw new CommandFailure("media.not_found", `No media with id "${mediaId}"`);
  }
}

/** Changes what's noted about a file: all clips of the file share it. */
export const setInfo = defineCommand({
  id: "media.setInfo",
  label: "Edit metadata",
  description:
    'Sets metadata on a file, shared by all its clips: camera, reel, scene, shot, take, tag ("good" or "rejected"), color (#rrggbb) and comments. What the patch leaves out stays, and null clears a field. Fails with media.not_found.',
  undoable: true,
  input: z.object({
    mediaId: z.string(),
    patch: z.object({
      camera: text,
      reel: text,
      scene: text,
      shot: text,
      take: text,
      tag: z.enum(["good", "rejected"]).nullable().optional(),
      color: z
        .string()
        .regex(/^#[0-9a-f]{6}$/i)
        .nullable()
        .optional(),
      comments: text,
    }),
  }),
  run(ctx, { mediaId, patch }) {
    const { store } = ctx.require(projectRef);
    requireMedia(store.getState(), mediaId);
    ctx.mutate(store, (draft) => {
      const info: Record<string, unknown> = { ...draft.media[mediaId]!.info };
      for (const [key, value] of Object.entries(patch)) {
        if (value === null) delete info[key];
        else if (value !== undefined) info[key] = value;
      }
      draft.media[mediaId]!.info = info as MediaInfo;
    });
  },
});

/** Gives a file another name in the library. The file on disk keeps its own. */
export const renameMedia = defineCommand({
  id: "media.rename",
  label: "Rename media",
  description:
    "Renames an item in the media library. The file on disk keeps its name. Fails with media.not_found.",
  undoable: true,
  input: z.object({ mediaId: z.string(), name: z.string().trim().min(1).max(200) }),
  run(ctx, { mediaId, name }) {
    const { store } = ctx.require(projectRef);
    requireMedia(store.getState(), mediaId);
    ctx.mutate(store, (draft) => {
      draft.media[mediaId]!.name = name;
    });
  },
});

export const mediaInfoCommands = [setInfo, renameMedia];

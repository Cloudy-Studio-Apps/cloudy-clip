import { z } from "zod";
import { CommandFailure, defineCommand } from "@/core";
import { projectRef } from "@/modules/project";
import { requirePictureClip } from "./mask.guards";

/** Makes a track's picture decide where clips show, or stops doing so. */
export const setMatte = defineCommand({
  id: "mask.setMatte",
  label: "Track matte",
  description:
    'Shows picture clips only where another video track\'s picture is: "trackId" is a video track of the same composition (null removes the matte), "by" is alpha (default) or luma, "invert" shows them where it isn\'t. Fails with mask.clip_not_found, mask.not_picture, mask.track_not_found (also another composition\'s), mask.not_video, mask.own_track (the clip\'s own track) and mask.matte_chain (the matte track holds a clip with a matte, or the clip\'s track is a matte of some clip).',
  undoable: true,
  input: z.object({
    clipIds: z.array(z.string()).min(1),
    trackId: z.string().nullable(),
    by: z.enum(["alpha", "luma"]).optional(),
    invert: z.boolean().optional(),
  }),
  run(ctx, { clipIds, trackId, by, invert }) {
    const { store } = ctx.require(projectRef);
    const state = store.getState();
    const clips = clipIds.map((id) => requirePictureClip(ctx, state, id));
    if (trackId !== null) {
      const matte = Object.hasOwn(state.tracks, trackId) ? state.tracks[trackId] : undefined;
      if (!matte) throw new CommandFailure("mask.track_not_found", `No track "${trackId}".`);
      const all = Object.values(state.clips);
      for (const clip of clips) {
        const own = state.tracks[clip.trackId]!;
        if (matte.compositionId !== own.compositionId) {
          throw new CommandFailure(
            "mask.track_not_found",
            `Track "${trackId}" is in another composition.`,
          );
        }
        if (matte.kind !== "video") {
          throw new CommandFailure("mask.not_video", `Track "${trackId}" is not a video track.`);
        }
        if (own.id === trackId) {
          throw new CommandFailure("mask.own_track", "A clip can't be matted by its own track.");
        }
        if (
          all.some((c) => c.trackId === trackId && c.matte) ||
          all.some((c) => c.matte?.trackId === own.id)
        ) {
          throw new CommandFailure("mask.matte_chain", "A matte can't itself have a matte.");
        }
      }
    }
    ctx.mutate(store, (draft) => {
      for (const clip of clips) {
        const target = draft.clips[clip.id]!;
        if (trackId === null) delete target.matte;
        else target.matte = { trackId, by: by ?? "alpha", ...(invert ? { invert: true } : {}) };
      }
    });
    return { clipIds };
  },
});

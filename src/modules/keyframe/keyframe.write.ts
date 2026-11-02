import type { CommandContext } from "@/core";
import { projectRef, type Clip, type KeyTrack, type KeyValue } from "@/modules/project";
import { requireField } from "./keyframe.guards";
import { keyframeRef } from "./keyframe.ref";
import type { KeyTarget } from "./keyframe.types";

/** The new state of some tracks of one clip; undefined removes the track. */
export interface TrackEdit {
  clipId: string;
  tracks: Record<string, KeyTrack | undefined>;
  /** Where a track is gone: the value its field keeps as the static value. */
  statics?: Record<string, KeyValue>;
}

/**
 * Writes the edits in one `ctx.mutate`, then makes the static values and runs the `afterWrite` of
 * the targets that changed, all inside the calling command (one undo step). Everything is looked
 * up before anything is written, so a field that can't be keyed fails with nothing changed.
 */
export async function writeTracks(ctx: CommandContext, edits: readonly TrackEdit[]) {
  const store = ctx.require(projectRef).store;
  const api = ctx.require(keyframeRef);
  const before = store.getState();
  const planned = edits.map((edit) => {
    const clip = before.clips[edit.clipId] as Clip;
    const statics = Object.entries(edit.statics ?? {}).map(
      ([path, value]) => [requireField(api, clip, path).field, value] as const,
    );
    const targets = new Map<string, KeyTarget>();
    for (const path of Object.keys(edit.tracks)) {
      const found = api.fieldOf(clip, path);
      if (found) targets.set(found.target.id, found.target);
    }
    return { edit, clip, statics, targets };
  });
  ctx.mutate(store, (draft) => {
    for (const { edit } of planned) {
      const clip = draft.clips[edit.clipId]!;
      const animation = { ...clip.animation };
      for (const [path, track] of Object.entries(edit.tracks)) {
        if (track) animation[path] = track;
        else delete animation[path];
      }
      if (Object.keys(animation).length > 0) clip.animation = animation;
      else delete clip.animation;
    }
  });
  for (const { edit, statics } of planned) {
    for (const [field, value] of statics) await field.commitStatic(ctx, edit.clipId, value);
  }
  for (const { edit, clip, targets } of planned) {
    for (const target of targets.values()) await target.afterWrite?.(ctx, edit.clipId, clip);
  }
}

import { notify, type CommandContext } from "@/core";
import { partnersOf, projectRef, type ClipId } from "@/modules/project";
import { unlinkClips } from "./timeline.clip.commands";
import { timelineRef } from "./timeline.ref";

/**
 * Runs an edit that, with `soundOnly`, leaves pictures alone: the linked clips among `clipIds`
 * that sit on audio tracks are unlinked first (by `unlinkClips`, nested, so the unlink and the
 * edit are one undo step), then `edit` reads the project as it is by then. An unlink that fails
 * fails the whole command, nothing written. The first such unlink of a session says so.
 */
export async function editSoundOnly<T>(
  ctx: CommandContext,
  clipIds: readonly ClipId[],
  soundOnly: boolean | undefined,
  edit: () => T,
): Promise<T> {
  if (!soundOnly) return edit();
  const state = ctx.require(projectRef).store.getState();
  const linked = clipIds.filter(
    (id) =>
      state.tracks[state.clips[id]?.trackId ?? ""]?.kind === "audio" &&
      partnersOf(state, id).length > 0,
  );
  if (linked.length === 0) return edit();
  await ctx.execute(unlinkClips, { clipIds: linked });
  const result = edit();
  const { view } = ctx.require(timelineRef);
  if (!view.getState().soundUnlinkTold) {
    view.setState({ soundUnlinkTold: true });
    notify("info", "Sound unlinked from its picture");
  }
  return result;
}

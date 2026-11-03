import { CommandFailure, notify, type CommandContext } from "@/core";
import { partnersOf, projectRef, type ClipId } from "@/modules/project";
import { kindInScope } from "./logic/scope";
import { unlinkClips } from "./timeline.clip.commands";
import { requireClip } from "./timeline.guards";
import { timelineRef } from "./timeline.ref";

/**
 * Runs an edit that, with `soundOnly`, leaves pictures alone. It acts on the named clips that sit
 * on audio tracks only: the others are dropped (a picture selected with its sound stays), and
 * naming no sound at all fails with `timeline.not_sound`. The linked ones are unlinked first (by
 * `unlinkClips`, nested, so the unlink and the edit are one undo step), then `edit` gets the ids
 * it may act on and reads the project as it is by then. An unlink that fails fails the whole
 * command, nothing written; if it is joined under a transition, the message says where to remove
 * it. The first such unlink of a session says so. Without `soundOnly`, `edit` gets `clipIds`.
 */
export async function editSoundOnly<T>(
  ctx: CommandContext,
  clipIds: readonly ClipId[],
  soundOnly: boolean | undefined,
  edit: (ids: ClipId[]) => T,
): Promise<T> {
  if (!soundOnly) return edit([...clipIds]);
  const state = ctx.require(projectRef).store.getState();
  clipIds.forEach((id) => requireClip(state, id));
  const sounds = clipIds.filter((id) =>
    kindInScope(state.tracks[state.clips[id]!.trackId]?.kind ?? "video", "sound"),
  );
  if (sounds.length === 0) {
    throw new CommandFailure(
      "timeline.not_sound",
      "soundOnly edits clips on audio tracks only; none of these is one.",
    );
  }
  const linked = sounds.filter((id) => partnersOf(state, id).length > 0);
  if (linked.length === 0) return edit(sounds);
  try {
    await ctx.execute(unlinkClips, { clipIds: linked });
  } catch (error) {
    if (error instanceof CommandFailure && error.code === "timeline.unlink_joined") {
      throw new CommandFailure(
        error.code,
        "This sound overlaps another under a transition between their pictures, so it can't be edited alone. Remove the transition on the Edit page first.",
        error.details,
      );
    }
    throw error;
  }
  const result = edit(sounds);
  const { view } = ctx.require(timelineRef);
  if (!view.getState().soundUnlinkTold) {
    view.setState({ soundUnlinkTold: true });
    notify("info", "Sound unlinked from its picture");
  }
  return result;
}

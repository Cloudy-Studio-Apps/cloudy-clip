import { z } from "zod";
import { CommandFailure, defineCommand, type CommandContext, type Micros } from "@/core";
import { previewRef } from "@/modules/preview";
import { clipEnd, contains, projectRef, withPartners, type Clip } from "@/modules/project";
import { clipboardEntry, pastePlan } from "./logic/paste";
import { sortClipIds } from "./logic/placement";
import { requireClip, targetComposition, time } from "./timeline.guards";
import { removeClips } from "./timeline.split.commands";
import { timelineRef } from "./timeline.ref";
import { addTrack } from "./timeline.track.commands";
import type { ClipboardEntry } from "./timeline.types";

/** Puts an entry on the timeline: checks it, makes the tracks it needs, adds the clips. */
async function paste(
  ctx: CommandContext,
  entry: ClipboardEntry,
  at: { time: Micros; trackId?: string },
): Promise<{ clips: Clip[] }> {
  const { store } = ctx.require(projectRef);
  const state = store.getState();
  const composition = targetComposition(ctx, at.trackId);
  for (const { mediaId, compositionRef } of entry.clips) {
    const gone =
      (mediaId !== undefined && !state.media[mediaId]) ||
      (compositionRef !== undefined && !state.compositions[compositionRef]);
    if (gone) {
      throw new CommandFailure(
        "timeline.clipboard_stale",
        "What was copied uses a file or composition that is no longer in the project.",
      );
    }
    if (compositionRef !== undefined && contains(state, compositionRef, composition.id)) {
      throw new CommandFailure(
        "composition.cycle",
        `"${state.compositions[compositionRef]!.name}" can't go inside "${composition.name}": a composition can't contain itself.`,
      );
    }
  }
  const plan = pastePlan(state, composition, entry, at);
  const clips: Clip[] = [];
  for (const placement of plan) {
    const trackId =
      placement.trackId ??
      (await ctx.execute(addTrack, { kind: placement.kind, compositionId: composition.id }))
        .trackId;
    clips.push(...placement.clips.map((clip) => ({ ...clip, trackId })));
  }
  ctx.mutate(store, (draft) => {
    for (const clip of clips) {
      draft.clips[clip.id] = clip;
      const track = draft.tracks[clip.trackId]!;
      track.clipIds = sortClipIds([...track.clipIds, clip.id], draft.clips);
    }
  });
  return { clips };
}

const copy = (ctx: CommandContext, clipIds: readonly string[]) => {
  const state = ctx.require(projectRef).store.getState();
  clipIds.forEach((id) => requireClip(state, id));
  const entry = clipboardEntry(state, clipIds);
  ctx.require(timelineRef).clipboard.set(ctx.actor, entry);
  return entry;
};

const selection = z.object({ clipIds: z.array(z.string()).min(1) });

/** Copies clips and their linked clips to your own clipboard. Changes nothing in the project. */
export const copyClips = defineCommand({
  id: "timeline.copyClips",
  label: "Copy",
  description:
    "Copies clips and their linked clips, with everything set on them, to your own clipboard, which only you can paste from. Returns { copied }.",
  undoable: false,
  input: selection,
  run(ctx, { clipIds }) {
    return { copied: copy(ctx, clipIds).clips.length };
  },
});

/** Copies clips and deletes them, as one undo step. */
export const cutClips = defineCommand({
  id: "timeline.cutClips",
  label: "Cut",
  description:
    "Copies clips and their linked clips to your own clipboard and deletes them, in one undo step. Junctions on them go; other clips stay where they are. Returns { deleted, removedJunctions }.",
  undoable: true,
  input: selection,
  run(ctx, { clipIds }) {
    copy(ctx, clipIds);
    const state = ctx.require(projectRef).store.getState();
    return removeClips(ctx, state, withPartners(state, clipIds));
  },
});

/** Pastes what you copied. */
export const pasteClips = defineCommand({
  id: "timeline.pasteClips",
  label: "Paste",
  description:
    "Pastes what you copied at `time` (default your playhead). Clips keep their spacing and get new ids; linked clips stay linked to each other. Each copied track stays together, on its original track when that's free, else on the first free track of its kind, else on a new track. With `trackId`, the first copied track of that kind goes there and the others keep their distance in tracks. Junctions aren't copied, so clips that overlapped under one land one after the other. Fails with timeline.clipboard_empty, timeline.clipboard_stale (a file or composition is gone) or composition.cycle. Returns { clips }.",
  undoable: true,
  input: z.object({ time: time.optional(), trackId: z.string().optional() }),
  async run(ctx, input) {
    const entry = ctx.require(timelineRef).clipboard.get(ctx.actor);
    if (!entry) throw new CommandFailure("timeline.clipboard_empty", "Nothing has been copied.");
    const at = input.time ?? ctx.require(previewRef).clockFor(ctx.actor).getTime();
    return paste(ctx, entry, { time: at, ...(input.trackId && { trackId: input.trackId }) });
  },
});

/** Pastes copies of clips right after them, without touching your clipboard. */
export const duplicateClips = defineCommand({
  id: "timeline.duplicateClips",
  label: "Duplicate",
  description:
    "Puts copies of clips and their linked clips right after the last of them, with the placement rules of timeline.pasteClips. Your clipboard stays as it is. Returns { clips }.",
  undoable: true,
  input: selection,
  async run(ctx, { clipIds }) {
    const state = ctx.require(projectRef).store.getState();
    clipIds.forEach((id) => requireClip(state, id));
    const entry = clipboardEntry(state, clipIds);
    return paste(ctx, entry, { time: Math.max(...entry.clips.map(clipEnd)) });
  },
});

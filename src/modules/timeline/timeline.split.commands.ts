import { produce } from "immer";
import { z } from "zod";
import { CommandFailure, createId, defineCommand, formatTimecode } from "@/core";
import { type Clip, projectRef, withPartners, compositionClips, formatOf } from "@/modules/project";
import { minClipDuration, sortClipIds } from "./logic/placement";
import { checkLayout, requireClip, time } from "./timeline.guards";
import {
  commitState,
  fitJunctions,
  junctionKindOf,
  junctionsOverlapping,
} from "./timeline.junctions";

/**
 * Splits clips in two at a time. A junction on a split clip's right edge moves to its right
 * half; a clip can't be split inside a junction's overlap.
 */
export const splitAt = defineCommand({
  id: "timeline.splitAt",
  label: "Split",
  description:
    "Splits clips in two at a timeline time. Pass clipIds to split only those (their linked clips are split too); otherwise every clip under that time is split. Linked halves stay linked: left with left, right with right. A junction (transition) at a split clip's end moves to its right half. Splitting inside a junction's overlap fails with junction.split_in_overlap when clipIds are given; without clipIds those clips (and their partners) are left whole and the rest are split. Returns the ids of the new right-hand clips.",
  undoable: true,
  input: z.object({ at: time, clipIds: z.array(z.string()).optional() }),
  run(ctx, { at, clipIds }) {
    const state = ctx.require(projectRef).store.getState();
    const open = clipIds ? undefined : ctx.require(projectRef).view.requireOpen(ctx.actor);
    if (clipIds) clipIds.forEach((id) => requireClip(state, id));
    const blocking = junctionsOverlapping(state, at);
    const blocked = new Set(
      withPartners(
        state,
        blocking.flatMap((j) => [j.leftClipId, j.rightClipId]),
      ),
    );
    const candidates = clipIds
      ? withPartners(state, clipIds).map((id) => requireClip(state, id))
      : compositionClips(state, open!.id).filter((clip) => !blocked.has(clip.id));
    const targets = candidates.filter((clip) => {
      const min = minClipDuration(formatOf(state, clip));
      return at - clip.start >= min && clip.start + clip.duration - at >= min;
    });
    const inOverlap = targets.find((clip) => blocked.has(clip.id));
    if (inOverlap) {
      throw new CommandFailure(
        "junction.split_in_overlap",
        `Clip "${inOverlap.id}" can't be split at ${formatTimecode(at)}: that is inside a junction's overlap. Split before or after it, or remove the junction first.`,
        { clipId: inOverlap.id },
      );
    }
    if (targets.length === 0) {
      throw new CommandFailure(
        "timeline.nothing_to_split",
        `No clip can be split at ${formatTimecode(at)}`,
      );
    }

    // Right halves of one linked pair share a new link.
    const rightLinks = new Map<string, string>();
    const created: string[] = [];
    const split = produce(state, (draft) => {
      for (const target of targets) {
        const left = draft.clips[target.id]!;
        const offset = at - left.start;
        let linkId: string | undefined;
        if (left.linkId) {
          linkId = rightLinks.get(left.linkId) ?? createId("link");
          rightLinks.set(left.linkId, linkId);
        }
        const base = {
          id: createId("clip"),
          trackId: left.trackId,
          start: at,
          duration: left.duration - offset,
          ...(left.transform && { transform: { ...left.transform } }),
          ...(linkId && { linkId }),
        };
        // Text has no source file, so its `sourceIn` stays 0.
        const right: Clip = {
          ...base,
          kind: left.kind,
          props: structuredClone(target.props),
          ...(left.mediaId !== undefined && { mediaId: left.mediaId }),
          ...(left.compositionRef !== undefined && { compositionRef: left.compositionRef }),
          sourceIn:
            left.mediaId === undefined && left.compositionRef === undefined
              ? 0
              : left.sourceIn + offset,
        };
        left.duration = offset;
        draft.clips[right.id] = right;
        const track = draft.tracks[left.trackId]!;
        track.clipIds = sortClipIds([...track.clipIds, right.id], draft.clips);
        // The cut at the clip's end now follows its right half.
        for (const junction of Object.values(draft.junctions)) {
          if (junction.leftClipId === left.id) junction.leftClipId = right.id;
        }
        created.push(right.id);
      }
    });
    const splitIds = [...targets.map((t) => t.id), ...created];
    const next = fitJunctions(split, splitIds, junctionKindOf(ctx));
    checkLayout(next, new Set(splitIds));
    commitState(ctx, state, next);
    return { created };
  },
});

/** Deletes clips and their linked clips, and the junctions on their cuts (nothing shifts). */
export const deleteClips = defineCommand({
  id: "timeline.deleteClips",
  label: "Delete",
  description:
    "Deletes clips from the timeline (the media stays in the library). Linked clips (a video's picture and sound) are deleted together. Junctions (transitions) on their cuts are removed; the other clips stay where they are. Returns { deleted, removedJunctions }.",
  undoable: true,
  input: z.object({ clipIds: z.array(z.string()).min(1) }),
  run(ctx, { clipIds }) {
    const state = ctx.require(projectRef).store.getState();
    clipIds.forEach((id) => requireClip(state, id));
    const all = withPartners(state, clipIds);
    const doomed = new Set(all);
    const removedJunctions = Object.values(state.junctions)
      .filter((j) => doomed.has(j.leftClipId) || doomed.has(j.rightClipId))
      .map((j) => j.id);
    ctx.mutate(ctx.require(projectRef).store, (draft) => {
      for (const id of all) {
        const clip = draft.clips[id];
        if (!clip) continue;
        const track = draft.tracks[clip.trackId];
        if (track) track.clipIds = track.clipIds.filter((c) => !doomed.has(c));
        delete draft.clips[id];
      }
      for (const id of removedJunctions) delete draft.junctions[id];
    });
    return { deleted: all.length, removedJunctions };
  },
});

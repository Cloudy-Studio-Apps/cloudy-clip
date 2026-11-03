import { produce } from "immer";
import { z } from "zod";
import {
  CommandFailure,
  createId,
  defineCommand,
  formatTimecode,
  type CommandContext,
  type Micros,
} from "@/core";
import {
  type Clip,
  type ClipId,
  type JunctionId,
  type ProjectState,
  compositionClips,
  contentTime,
  followsFileTime,
  formatOf,
  projectRef,
  sourceTimeAt,
  withPartners,
} from "@/modules/project";
import { minClipDuration, sortClipIds } from "./logic/placement";
import { checkLayout, requireClip, time } from "./timeline.guards";
import {
  commitState,
  fitJunctions,
  junctionKindOf,
  junctionsOverlapping,
} from "./timeline.junctions";
import { editSoundOnly } from "./timeline.sound";
import type { JunctionKindOf } from "./timeline.types";

/** `state` with the clips split at a time: the right halves stay linked, junctions are kept. */
export function splitClips(
  state: ProjectState,
  at: Micros,
  targets: readonly Clip[],
  kindOf: JunctionKindOf,
): { next: ProjectState; created: ClipId[] } {
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
        ...(left.composite && { composite: { ...left.composite } }),
        ...(left.speed && { speed: { ...left.speed } }),
        // Both halves keep the curve, and the right one starts where the cut is on the picture.
        ...(target.animation && {
          animation: structuredClone(target.animation),
          animationOrigin: contentTime(target, at),
        }),
        ...(left.disabled && { disabled: true as const }),
        // A fade stays on the outer edge of its piece.
        ...(left.sound && { sound: { ...structuredClone(target.sound!), fadeIn: 0 } }),
        ...(linkId && { linkId }),
      };
      // Text and images have no time of their own, so their `sourceIn` stays 0.
      const right: Clip = {
        ...base,
        kind: left.kind,
        props: structuredClone(target.props),
        ...(left.mediaId !== undefined && { mediaId: left.mediaId }),
        ...(left.compositionRef !== undefined && { compositionRef: left.compositionRef }),
        sourceIn:
          followsFileTime(draft, left) || left.speed?.rate === 0 ? sourceTimeAt(target, at) : 0,
      };
      if (left.speed?.reversed) {
        // Played backwards, the left half is the later part of the file.
        [left.sourceIn, right.sourceIn] = [right.sourceIn, left.sourceIn];
      }
      left.duration = offset;
      if (left.sound) left.sound.fadeOut = 0;
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
  const next = fitJunctions(split, [...targets.map((t) => t.id), ...created], kindOf);
  return { next, created };
}

/**
 * Splits clips in two at a time. A junction on a split clip's right edge moves to its right
 * half; a clip can't be split inside a junction's overlap.
 */
export const splitAt = defineCommand({
  id: "timeline.splitAt",
  label: "Split",
  description:
    "Splits clips in two at a timeline time. Pass clipIds to split only those (their linked clips are split too); otherwise every clip under that time in your open composition is split. Linked halves stay linked: left with left, right with right. A junction (transition) at a split clip's end moves to its right half. Splitting inside a junction's overlap fails with junction.split_in_overlap when clipIds are given; without clipIds those clips (and their partners) are left whole and the rest are split. Returns the ids of the new right-hand clips.",
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

    const { next, created } = splitClips(state, at, targets, junctionKindOf(ctx));
    checkLayout(next, new Set([...targets.map((t) => t.id), ...created]));
    commitState(ctx, state, next);
    return { created };
  },
});

/** Deletes clips and their linked clips, and the junctions on their cuts (nothing shifts). */
export const deleteClips = defineCommand({
  id: "timeline.deleteClips",
  label: "Delete",
  description:
    "Deletes clips from the timeline (the media stays in the library). Linked clips (a video's picture and sound) are deleted together. Junctions (transitions) on their cuts are removed; the other clips stay where they are. Returns { deleted, removedJunctions }. With soundOnly, only the clips on audio tracks are deleted (picture clips named with them are left alone, and naming none fails with timeline.not_sound): linked ones are unlinked first and deleted alone, so their pictures stay (one undo step).",
  undoable: true,
  input: z.object({ clipIds: z.array(z.string()).min(1), soundOnly: z.boolean().optional() }),
  run: (ctx, { clipIds, soundOnly }) =>
    editSoundOnly(ctx, clipIds, soundOnly, (ids) => {
      const state = ctx.require(projectRef).store.getState();
      ids.forEach((id) => requireClip(state, id));
      return removeClips(ctx, state, withPartners(state, ids));
    }),
});

/** `state` without the clips and the junctions on their cuts; nothing shifts. */
export function withoutClips(
  state: ProjectState,
  ids: readonly ClipId[],
): { next: ProjectState; removedJunctions: JunctionId[] } {
  const doomed = new Set(ids);
  const removedJunctions = Object.values(state.junctions)
    .filter((j) => doomed.has(j.leftClipId) || doomed.has(j.rightClipId))
    .map((j) => j.id);
  const next = produce(state, (draft) => {
    for (const id of ids) {
      const clip = draft.clips[id];
      if (!clip) continue;
      const track = draft.tracks[clip.trackId];
      if (track) track.clipIds = track.clipIds.filter((c) => !doomed.has(c));
      delete draft.clips[id];
    }
    for (const id of removedJunctions) delete draft.junctions[id];
  });
  return { next, removedJunctions };
}

/** Removes clips (with their partners already in `ids`) and their junctions, as one step. */
export function removeClips(ctx: CommandContext, state: ProjectState, ids: readonly ClipId[]) {
  const { next, removedJunctions } = withoutClips(state, ids);
  commitState(ctx, state, next);
  return { deleted: ids.length, removedJunctions };
}

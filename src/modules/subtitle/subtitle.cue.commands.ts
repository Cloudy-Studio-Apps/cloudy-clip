import { z } from "zod";
import { CommandFailure, defineCommand } from "@/core";
import { setProps } from "@/modules/element";
import { formatOf, frameDuration, projectRef } from "@/modules/project";
import {
  addElement,
  addTrack,
  deleteClips,
  findOverlap,
  minClipDuration,
  splitAt,
  trimClip,
} from "@/modules/timeline";
import { requireCue, requireComposition, requireStyle } from "./subtitle.guards";
import { mark } from "./subtitle.mark.commands";

const words = (clip: { props: Record<string, unknown> }) => String(clip.props.text ?? "");

/** A new cue: a text clip with words, marked with a style. */
export const addCue = defineCommand({
  id: "subtitle.addCue",
  label: "Add subtitle",
  description:
    'Adds a subtitle cue "text" at "start" for "duration" (microseconds, at least one frame) in your open composition or compositionId. It goes on "trackId", else on the track of the cue before it, else on a new top track named "Subtitles". Marked with "styleId" or the composition\'s default style. One undo step. Fails with subtitle.overlap (a clip is in the way), subtitle.style_not_found, subtitle.composition_not_found and timeline failures. Returns { clipId }.',
  undoable: true,
  input: z.object({
    compositionId: z.string().optional(),
    trackId: z.string().optional(),
    start: z.number().int().min(0).describe("Microseconds"),
    duration: z.number().int().positive().describe("Microseconds"),
    text: z.string().min(1),
    styleId: z.string().optional(),
  }),
  async run(ctx, input) {
    const { store } = ctx.require(projectRef);
    const composition = requireComposition(ctx, input.compositionId);
    const state = store.getState();
    if (input.styleId !== undefined) requireStyle(state, input.styleId);
    let trackId = input.trackId;
    if (trackId === undefined) {
      const before = composition.trackOrder
        .flatMap((id) => state.tracks[id]?.clipIds ?? [])
        .map((id) => state.clips[id]!)
        .filter((clip) => clip.subtitle && clip.start <= input.start)
        .sort((a, b) => b.start - a.start)[0];
      trackId = before?.trackId;
    }
    if (trackId !== undefined && findOverlap(state, trackId, input.start, input.duration)) {
      throw new CommandFailure(
        "subtitle.overlap",
        `A clip on track "${trackId}" is in the way of this cue.`,
      );
    }
    if (trackId === undefined) {
      const made = await ctx.execute(addTrack, {
        kind: "video",
        index: 0,
        name: "Subtitles",
        compositionId: composition.id,
      });
      trackId = made.trackId;
    }
    const clip = await ctx.execute(addElement, {
      kind: "text",
      props: { text: input.text },
      start: input.start,
      duration: input.duration,
      trackId,
    });
    await ctx.execute(mark, { clipIds: [clip.id], styleId: input.styleId });
    return { clipId: clip.id };
  },
});

/** One cue cut in two by a place in its words. */
export const splitCue = defineCommand({
  id: "subtitle.splitCue",
  label: "Split subtitle",
  description:
    'Splits a cue into two at the character index "at" of its words (strictly inside them, else subtitle.split_outside). The cut falls at the same share of the cue\'s time, on a frame, and each half keeps its side of the words (trimmed at the cut) and the cue\'s look and mark. "text" gives the words as just typed, so typing and splitting are one undo step. Fails with subtitle.clip_not_found, subtitle.not_text, subtitle.not_marked and timeline failures. Returns { clipIds: [first, second] }.',
  undoable: true,
  input: z.object({
    clipId: z.string(),
    at: z.number().int().min(0).describe("Character index in the words"),
    text: z.string().optional(),
  }),
  async run(ctx, { clipId, at, text }) {
    const state = ctx.require(projectRef).store.getState();
    const { clip } = requireCue(state, clipId);
    const all = text ?? words(clip);
    const first = all.slice(0, at).trimEnd();
    const second = all.slice(at).trimStart();
    if (at <= 0 || at >= all.length || first === "" || second === "") {
      throw new CommandFailure("subtitle.split_outside", `Index ${at} is not inside the words.`);
    }
    const frame = frameDuration(formatOf(state, clip));
    const min = minClipDuration(formatOf(state, clip));
    const share = clip.start + (clip.duration * at) / all.length;
    const cut = Math.round(share / frame) * frame;
    const time = Math.min(Math.max(cut, clip.start + min), clip.start + clip.duration - min);
    const { created } = await ctx.execute(splitAt, { at: time, clipIds: [clipId] });
    const right = created[0]!;
    await ctx.execute(setProps, { clipIds: [clipId], patch: { text: first } });
    await ctx.execute(setProps, { clipIds: [right], patch: { text: second } });
    return { clipIds: [clipId, right] as [string, string] };
  },
});

/** Two neighbouring cues made one. */
export const mergeCues = defineCommand({
  id: "subtitle.mergeCues",
  label: "Merge subtitles",
  description:
    'Merges two cues on one track, the second starting where the first ends (within a microsecond), into the first: it ends where the second did and its words are both joined with a space, or "text". Fails with subtitle.not_adjacent, subtitle.clip_not_found, subtitle.not_text and subtitle.not_marked. Returns { clipId }.',
  undoable: true,
  input: z.object({
    clipIds: z.tuple([z.string(), z.string()]),
    text: z.string().optional(),
  }),
  async run(ctx, { clipIds: [firstId, secondId], text }) {
    const state = ctx.require(projectRef).store.getState();
    const { clip: first } = requireCue(state, firstId);
    const { clip: second } = requireCue(state, secondId);
    const gap = second.start - (first.start + first.duration);
    if (first.trackId !== second.trackId || Math.abs(gap) > 1) {
      throw new CommandFailure(
        "subtitle.not_adjacent",
        `Cue "${secondId}" does not start where "${firstId}" ends on the same track.`,
      );
    }
    const joined = text ?? `${words(first).trimEnd()} ${words(second).trimStart()}`;
    await ctx.execute(deleteClips, { clipIds: [secondId] });
    await ctx.execute(trimClip, {
      clipId: firstId,
      edge: "end",
      time: second.start + second.duration,
    });
    await ctx.execute(setProps, { clipIds: [firstId], patch: { text: joined } });
    return { clipId: firstId };
  },
});

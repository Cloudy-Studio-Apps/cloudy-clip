import {
  sameSpeed,
  withPartners,
  type Clip,
  type ClipId,
  type ProjectState,
} from "@/modules/project";

/**
 * The one clip a selection is about: the only selected clip, or the first one when the
 * selection is exactly one linked group (a video's picture and sound). Otherwise undefined.
 */
export function selectionSubject(
  state: ProjectState,
  selection: readonly ClipId[],
): ClipId | undefined {
  const [first] = selection;
  if (first === undefined) return undefined;
  const group = withPartners(state, [first]);
  const sameGroup =
    selection.length === group.length && selection.every((id) => group.includes(id));
  return sameGroup ? first : undefined;
}

/** The picture and sound of a selection that could be linked: one of each, both unlinked. */
export function linkPair(
  state: ProjectState,
  clipIds: readonly ClipId[],
): [Clip, Clip] | undefined {
  if (clipIds.length !== 2) return undefined;
  const clips = clipIds.flatMap((id) => state.clips[id] ?? []);
  const kindOf = (clip: Clip) => state.tracks[clip.trackId]?.kind;
  const picture = clips.find((clip) => kindOf(clip) === "video");
  const sound = clips.find((clip) => kindOf(clip) === "audio");
  if (!picture || !sound || picture.linkId || sound.linkId) return undefined;
  return [picture, sound];
}

/** Whether a pair is what an unlink leaves: the same file, at the same time. */
export function sameTiming([a, b]: [Clip, Clip]): boolean {
  return (
    a.mediaId !== undefined &&
    a.mediaId === b.mediaId &&
    a.start === b.start &&
    a.duration === b.duration &&
    a.sourceIn === b.sourceIn &&
    sameSpeed(a, b)
  );
}

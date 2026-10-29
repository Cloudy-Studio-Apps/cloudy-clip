import { withPartners, type ClipId, type ProjectState } from "@/modules/project";

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

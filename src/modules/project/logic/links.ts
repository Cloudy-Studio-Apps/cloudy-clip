import type { Clip, ClipId, ProjectState } from "../project.types";

/**
 * The other clips linked to a clip (same `linkId`). Empty when the clip is unlinked or its
 * partner no longer exists, so a half-removed pair edits like a single clip.
 */
export function partnersOf(state: ProjectState, clipId: ClipId): Clip[] {
  const linkId = state.clips[clipId]?.linkId;
  if (!linkId) return [];
  return Object.values(state.clips).filter((c) => c.linkId === linkId && c.id !== clipId);
}

/** The ids plus their linked partners: input order first, no duplicates. */
export function withPartners(state: ProjectState, clipIds: readonly ClipId[]): ClipId[] {
  const result = new Set(clipIds);
  for (const id of clipIds) for (const partner of partnersOf(state, id)) result.add(partner.id);
  return [...result];
}

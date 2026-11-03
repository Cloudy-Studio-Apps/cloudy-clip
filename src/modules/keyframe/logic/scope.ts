import type { TimelineScopeName } from "@/core";
import type { ProjectState } from "@/modules/project";
import { clipsInScope } from "@/modules/timeline";
import type { KeyRef } from "../keyframe.types";

/** The keys of the clips a timeline scope lists: on `"sound"`, never a picture's. */
export function keysInScope(
  state: ProjectState,
  keys: readonly KeyRef[],
  scope: TimelineScopeName,
): KeyRef[] {
  const clips = keys.flatMap((key) => state.clips[key.clipId] ?? []);
  const listed = new Set(clipsInScope(state, clips, scope).map((clip) => clip.id));
  return keys.filter((key) => listed.has(key.clipId));
}

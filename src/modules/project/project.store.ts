import { createPatchableStore } from "@/core";
import { projectPolicy } from "./logic/fields";
import type { ProjectFormat, ProjectState } from "./project.types";

/** Format of what has no composition to take one from. */
export const DEFAULT_FORMAT: ProjectFormat = { width: 1080, height: 1920, fps: 30 };

/** A fresh project: nothing yet. The first composition comes from a drop or the dialog. */
export function createEmptyProject(): ProjectState {
  return {
    compositions: {},
    compositionOrder: [],
    mainCompositionId: null,
    media: {},
    mediaOrder: [],
    tracks: {},
    clips: {},
    junctions: {},
  };
}

/** Creates the project document of one kernel. */
export function createProjectStore(initial: ProjectState = createEmptyProject()) {
  return createPatchableStore<ProjectState>("project", initial, projectPolicy);
}

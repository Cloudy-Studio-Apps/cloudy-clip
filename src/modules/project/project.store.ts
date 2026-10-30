import { createId, createPatchableStore } from "@/core";
import { projectPolicy } from "./logic/fields";
import type { FormatPreset, ProjectFormat, ProjectState } from "./project.types";

/** Output size for each preset. */
export const FORMAT_PRESETS: Record<FormatPreset, ProjectFormat> = {
  "9:16": { width: 1080, height: 1920, fps: 30 },
  "16:9": { width: 1920, height: 1080, fps: 30 },
  "1:1": { width: 1080, height: 1080, fps: 30 },
};

/** Format of what has no composition to take one from. */
export const DEFAULT_FORMAT: ProjectFormat = FORMAT_PRESETS["9:16"];

/** A fresh project: one vertical composition with a video track and an audio track. */
export function createEmptyProject(): ProjectState {
  const composition = createId("composition");
  const video = createId("track");
  const audio = createId("track");
  return {
    compositions: {
      [composition]: {
        id: composition,
        name: "Main",
        format: DEFAULT_FORMAT,
        background: "#000000",
        duration: 33_334,
        extendToFit: true,
        trackOrder: [video, audio],
      },
    },
    compositionOrder: [composition],
    mainCompositionId: composition,
    media: {},
    mediaOrder: [],
    tracks: {
      [video]: {
        id: video,
        compositionId: composition,
        kind: "video",
        name: "Video 1",
        clipIds: [],
        muted: false,
        hidden: false,
      },
      [audio]: {
        id: audio,
        compositionId: composition,
        kind: "audio",
        name: "Audio 1",
        clipIds: [],
        muted: false,
        hidden: false,
      },
    },
    clips: {},
    junctions: {},
  };
}

/** Creates the project document of one kernel. */
export function createProjectStore(initial: ProjectState = createEmptyProject()) {
  return createPatchableStore<ProjectState>("project", initial, projectPolicy);
}

import { createId, createPatchableStore } from "@/core";
import type { FormatPreset, ProjectFormat, ProjectState } from "./project.types";

/** Output size for each preset. */
export const FORMAT_PRESETS: Record<FormatPreset, ProjectFormat> = {
  "9:16": { width: 1080, height: 1920, fps: 30 },
  "16:9": { width: 1920, height: 1080, fps: 30 },
  "1:1": { width: 1080, height: 1080, fps: 30 },
};

/** A fresh project: vertical format, one video track and one audio track. */
export function createEmptyProject(): ProjectState {
  const video = createId("track");
  const audio = createId("track");
  return {
    format: FORMAT_PRESETS["9:16"],
    media: {},
    mediaOrder: [],
    tracks: {
      [video]: {
        id: video,
        kind: "video",
        name: "Video 1",
        clipIds: [],
        muted: false,
        hidden: false,
      },
      [audio]: {
        id: audio,
        kind: "audio",
        name: "Audio 1",
        clipIds: [],
        muted: false,
        hidden: false,
      },
    },
    trackOrder: [video, audio],
    clips: {},
  };
}

/** Creates the project document of one kernel. */
export function createProjectStore(initial: ProjectState = createEmptyProject()) {
  return createPatchableStore<ProjectState>("project", initial);
}

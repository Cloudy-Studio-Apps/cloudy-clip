import { z } from "zod";
import { defineCommand } from "@/core";
import { clampToClip, contentTime, projectRef, trackValue, type KeyValue } from "@/modules/project";
import { requireClip, requireField, time } from "./keyframe.guards";
import { keyframeRef } from "./keyframe.ref";
import { copyKeys, pasteKeys } from "./keyframe.clipboard.commands";
import { scaleKeys, setAfter, setEase } from "./keyframe.ease.commands";
import { moveKeys, removeKeys, setKey, setKeyValues } from "./keyframe.edit.commands";
import { writeTracks, type TrackEdit } from "./keyframe.write";

/** Removes whole tracks. */
export const clearKeys = defineCommand({
  id: "keyframe.clear",
  label: "Clear keyframes",
  description:
    'Removes every key of the given fields of a clip ("paths", e.g. ["transform.x"]). The value each had at "at" (a timeline time, microseconds) becomes its static value. Fields without keys are skipped. Returns { cleared }, the paths.',
  undoable: true,
  input: z.object({ clipId: z.string(), paths: z.array(z.string()).min(1), at: time }),
  async run(ctx, input) {
    const state = ctx.require(projectRef).store.getState();
    const api = ctx.require(keyframeRef);
    const clip = requireClip(state, input.clipId);
    const t = contentTime(clip, clampToClip(clip, input.at));
    const edit: TrackEdit = { clipId: clip.id, tracks: {}, statics: {} };
    for (const path of input.paths) {
      const track = clip.animation?.[path];
      if (!track) continue;
      requireField(api, clip, path);
      edit.tracks[path] = undefined;
      edit.statics![path] = trackValue(track, t) satisfies KeyValue;
    }
    const cleared = Object.keys(edit.tracks);
    if (cleared.length > 0) await writeTracks(ctx, [edit]);
    return { cleared };
  },
});

/** The keyframe module's commands. */
export const keyframeCommands = [
  setKey,
  removeKeys,
  moveKeys,
  setKeyValues,
  clearKeys,
  setEase,
  setAfter,
  scaleKeys,
  copyKeys,
  pasteKeys,
];

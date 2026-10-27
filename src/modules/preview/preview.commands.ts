import { z } from "zod";
import { CommandFailure, defineCommand } from "@/core";
import { projectDuration, projectRef } from "@/modules/project";
import { previewRef } from "./preview.ref";

/** Starts playback from the playhead. */
export const play = defineCommand({
  id: "preview.play",
  label: "Play",
  description: "Starts playback from the playhead.",
  undoable: false,
  input: z.object({}),
  run(ctx) {
    const { playback } = ctx.require(previewRef);
    if (projectDuration(ctx.require(projectRef).store.getState()) === 0) {
      throw new CommandFailure("preview.empty", "The timeline is empty");
    }
    playback.play();
    return { time: playback.getTime() };
  },
});

/** Pauses playback. */
export const pause = defineCommand({
  id: "preview.pause",
  label: "Pause",
  description: "Pauses playback. Returns the playhead time (microseconds).",
  undoable: false,
  input: z.object({}),
  run(ctx) {
    const { playback } = ctx.require(previewRef);
    playback.pause();
    return { time: playback.getTime() };
  },
});

/** Toggles playback. */
export const togglePlay = defineCommand({
  id: "preview.togglePlay",
  label: "Play/Pause",
  description: "Plays if paused, pauses if playing.",
  undoable: false,
  input: z.object({}),
  run(ctx) {
    const { playback } = ctx.require(previewRef);
    if (playback.isPlaying()) playback.pause();
    else playback.play();
    return { playing: playback.isPlaying(), time: playback.getTime() };
  },
});

/** Moves the playhead. */
export const seek = defineCommand({
  id: "preview.seek",
  label: "Seek",
  description: "Moves the playhead to a timeline time (microseconds), clamped to the timeline.",
  undoable: false,
  input: z.object({ time: z.number().int().min(0).describe("Microseconds") }),
  run(ctx, { time }) {
    const { playback } = ctx.require(previewRef);
    playback.seek(time);
    return { time: playback.getTime() };
  },
});

export const previewCommands = [play, pause, togglePlay, seek];

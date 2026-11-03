import { z } from "zod";
import { CommandFailure, defineCommand } from "@/core";
import { compositionContent, projectRef } from "@/modules/project";
import { previewRef } from "./preview.ref";

/** Starts playback from the playhead. */
export const play = defineCommand({
  id: "preview.play",
  label: "Play",
  description:
    "Starts your playhead moving. An agent's playhead only advances: nothing plays or is drawn, and the user's preview stays put.",
  undoable: false,
  input: z.object({}),
  run(ctx) {
    const playback = ctx.require(previewRef).clockFor(ctx.actor);
    const { store, view } = ctx.require(projectRef);
    if (compositionContent(store.getState(), view.requireOpen(ctx.actor).id) === 0) {
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
  description: "Pauses your playback. Returns your playhead time (microseconds).",
  undoable: false,
  input: z.object({}),
  run(ctx) {
    const playback = ctx.require(previewRef).clockFor(ctx.actor);
    playback.pause();
    return { time: playback.getTime() };
  },
});

/** Toggles playback. */
export const togglePlay = defineCommand({
  id: "preview.togglePlay",
  label: "Play/Pause",
  description: "Plays your playhead if paused, pauses it if playing.",
  undoable: false,
  input: z.object({}),
  run(ctx) {
    const playback = ctx.require(previewRef).clockFor(ctx.actor);
    if (playback.isPlaying()) playback.pause();
    else playback.play();
    return { playing: playback.isPlaying(), time: playback.getTime() };
  },
});

/** Moves the playhead. */
export const seek = defineCommand({
  id: "preview.seek",
  label: "Seek",
  description: "Moves your playhead to a timeline time (microseconds), clamped to the timeline.",
  undoable: false,
  input: z.object({ time: z.number().int().min(0).describe("Microseconds") }),
  run(ctx, { time }) {
    const playback = ctx.require(previewRef).clockFor(ctx.actor);
    playback.seek(time);
    return { time: playback.getTime() };
  },
});

/**
 * Sets the loop region of the user's playhead, or clears it (null). View state: never in the
 * project or history, and no MCP tool (an agent's clock plays nothing).
 */
export const setLoop = defineCommand({
  id: "preview.setLoop",
  label: "Set loop",
  description:
    "Sets the user's loop region (microseconds) in the open composition, or clears it with null. Playing, crossing `to` goes back to `from`. Ends are clamped to the composition; fails with preview.loop_too_short under one frame.",
  undoable: false,
  input: z.object({
    range: z
      .object({ from: z.number().int().min(0), to: z.number().int().min(0) })
      .nullable()
      .describe("Microseconds; null clears the loop"),
  }),
  run(ctx, { range }) {
    const { playback } = ctx.require(previewRef);
    if (!playback.setLoop(range)) {
      throw new CommandFailure("preview.loop_too_short", "A loop must be at least one frame long");
    }
    return { loop: playback.getLoop() };
  },
});

export const previewCommands = [play, pause, togglePlay, seek, setLoop];

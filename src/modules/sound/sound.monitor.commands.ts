import { z } from "zod";
import { defineCommand } from "@/core";
import { projectRef, volumeDbSchema } from "@/modules/project";
import { previewRef } from "@/modules/preview";
import { audioTrack } from "./sound.guards";
import { soundRef } from "./sound.ref";

/**
 * Solos an audio track or lets it go: while any track is soloed, only soloed tracks sound. For
 * listening only, so never undone, saved or exported, and no MCP tool (it acts on the user's ears).
 */
export const setSolo = defineCommand({
  id: "sound.setSolo",
  label: "Solo track",
  description:
    "Solos an audio track (on) or lets it go (off). While any track is soloed, only soloed tracks sound. Not saved, not exported. Fails with sound.not_audio on a video track and sound.track_not_found.",
  undoable: false,
  input: z.object({ trackId: z.string(), on: z.boolean() }),
  run(ctx, { trackId, on }) {
    audioTrack(ctx.require(projectRef).store.getState(), trackId);
    const { view } = ctx.require(soundRef);
    const { solo } = view.getState();
    if (solo.includes(trackId) === on) return;
    const next = on ? [...solo, trackId] : solo.filter((id) => id !== trackId);
    view.setState({ solo: next });
    ctx.require(previewRef).sound.setSolo(next);
  },
});

/**
 * Changes how the user listens: Mono, Dim (20 dB down) and the speaker volume. Only the values
 * passed change. Never undone, saved or exported, and no MCP tool.
 */
export const setMonitor = defineCommand({
  id: "sound.setMonitor",
  label: "Change monitoring",
  description:
    "Changes how the user listens: mono (both sides summed), dim (20 dB down) and speakerDb (-60 to 12). Only the values passed change. Not saved, not exported.",
  undoable: false,
  input: z.object({
    mono: z.boolean().optional(),
    dim: z.boolean().optional(),
    speakerDb: volumeDbSchema.optional(),
  }),
  run(ctx, patch) {
    const { view } = ctx.require(soundRef);
    const monitor = { ...view.getState().monitor };
    if (patch.mono !== undefined) monitor.mono = patch.mono;
    if (patch.dim !== undefined) monitor.dim = patch.dim;
    if (patch.speakerDb !== undefined) monitor.speakerDb = patch.speakerDb;
    view.setState({ monitor });
    ctx.require(previewRef).sound.setMonitor(monitor);
  },
});

/**
 * Lets every soloed track go and turns Mono and Dim off; the speaker volume stays, like a knob on
 * the desk. Run when the user leaves the Sound page, since nothing elsewhere shows them.
 */
export const clearListening = defineCommand({
  id: "sound.clearListening",
  label: "Stop soloing and dimming",
  description:
    "Lets every soloed track go and turns Mono and Dim off. The speaker volume stays. Not saved, not exported.",
  undoable: false,
  input: z.object({}),
  run(ctx) {
    const { view } = ctx.require(soundRef);
    const { solo, monitor } = view.getState();
    if (solo.length === 0 && !monitor.mono && !monitor.dim) return;
    const next = { ...monitor, mono: false, dim: false };
    view.setState({ solo: [], monitor: next });
    const { sound } = ctx.require(previewRef);
    sound.setSolo([]);
    sound.setMonitor(next);
  },
});

/** Every listening command, for the module. */
export const soundMonitorCommands = [setSolo, setMonitor, clearListening];

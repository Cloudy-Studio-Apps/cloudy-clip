import { z } from "zod";
import { CommandFailure, defineCommand } from "@/core";
import {
  DEFAULT_SOUND,
  partnersOf,
  projectRef,
  soundOf,
  type ClipId,
  type ClipSound,
  type ProjectState,
} from "@/modules/project";

const band = z.object({
  on: z.boolean(),
  shape: z.enum(["bell", "lowShelf", "highShelf", "lowCut", "highCut"]),
  hz: z.number().min(20).max(20000),
  db: z.number().min(-24).max(24),
  q: z.number().min(0.1).max(10),
});
const patch = z.object({
  volumeDb: z.number().min(-60).max(12).optional(),
  pan: z.number().min(-1).max(1).optional(),
  fadeIn: z.number().int().min(0).optional().describe("Microseconds"),
  fadeOut: z.number().int().min(0).optional().describe("Microseconds"),
  pitch: z
    .object({
      on: z.boolean(),
      semitones: z.number().int().min(-24).max(24),
      cents: z.number().int().min(-100).max(100),
    })
    .optional(),
  eq: z.object({ on: z.boolean(), bands: z.array(band).length(6) }).optional(),
});

const SECTIONS: Record<string, readonly (keyof ClipSound)[]> = {
  volume: ["volumeDb"],
  pan: ["pan"],
  fades: ["fadeIn", "fadeOut"],
  pitch: ["pitch"],
  eq: ["eq"],
};

/** The clips that carry the sound of these: themselves, or their linked partner on an audio track. */
function soundClips(state: ProjectState, clipIds: readonly ClipId[]): ClipId[] {
  const found = new Set<ClipId>();
  for (const id of clipIds) {
    const clip = state.clips[id];
    if (!clip) throw new CommandFailure("timeline.clip_not_found", `No clip with id "${id}"`);
    const carrier = [clip, ...partnersOf(state, id)].find(
      (one) => state.tracks[one.trackId]?.kind === "audio",
    );
    if (!carrier) throw new CommandFailure("audio.no_sound", `Clip "${id}" has no sound.`);
    found.add(carrier.id);
  }
  return [...found];
}

/** `sound`, or undefined when it's what a clip has anyway, so defaults are never stored. */
function stored(sound: ClipSound): ClipSound | undefined {
  return JSON.stringify(sound) === JSON.stringify(DEFAULT_SOUND) ? undefined : sound;
}

function write(target: { sound?: ClipSound }, sound: ClipSound): void {
  const next = stored(sound);
  if (next) target.sound = next;
  else delete target.sound;
}

/** Changes how clips sound. */
export const setSound = defineCommand({
  id: "audio.setSound",
  label: "Change sound",
  description:
    "Changes how clips sound: volumeDb (-60 to 12), pan (-1 left to 1 right), fadeIn and fadeOut (microseconds, kept within the clip), pitch { on, semitones, cents }, eq { on, bands } (always six: shape, hz, db, q, on). Passing the picture of a linked clip changes its sound clip. Fails with audio.no_sound. Set a whole pitch or eq object at a time.",
  undoable: true,
  input: z.object({ clipIds: z.array(z.string()).min(1), patch }),
  run(ctx, { clipIds, patch }) {
    const { store } = ctx.require(projectRef);
    const ids = soundClips(store.getState(), clipIds);
    ctx.mutate(store, (draft) => {
      for (const id of ids) {
        const clip = draft.clips[id]!;
        const defined = Object.entries(patch).filter(([, value]) => value !== undefined);
        const next = { ...soundOf(clip), ...Object.fromEntries(defined) } as ClipSound;
        next.fadeIn = Math.min(next.fadeIn, clip.duration);
        next.fadeOut = Math.min(next.fadeOut, clip.duration);
        write(clip, next);
      }
    });
  },
});

/** Puts clips' sound, or one part of it, back to the file's own. */
export const resetSound = defineCommand({
  id: "audio.resetSound",
  label: "Reset sound",
  description:
    'Puts clips\' sound back as the file has it. Pass section ("volume", "pan", "fades", "pitch" or "eq") to reset that part only. Fails with audio.no_sound.',
  undoable: true,
  input: z.object({
    clipIds: z.array(z.string()).min(1),
    section: z.enum(["volume", "pan", "fades", "pitch", "eq"]).optional(),
  }),
  run(ctx, { clipIds, section }) {
    const { store } = ctx.require(projectRef);
    const ids = soundClips(store.getState(), clipIds);
    ctx.mutate(store, (draft) => {
      for (const id of ids) {
        const clip = draft.clips[id]!;
        if (!section) {
          delete clip.sound;
          continue;
        }
        const next = { ...soundOf(clip) } as Record<string, unknown>;
        for (const key of SECTIONS[section]!) next[key] = DEFAULT_SOUND[key];
        write(clip, next as unknown as ClipSound);
      }
    });
  },
});

export const audioCommands = [setSound, resetSound];

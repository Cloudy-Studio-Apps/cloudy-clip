import { z } from "zod";
import { CommandFailure, defineCommand } from "@/core";
import {
  DEFAULT_SOUND,
  eqSchema,
  minimize,
  panSchema,
  partnersOf,
  projectRef,
  soundOf,
  volumeDbSchema,
  type Clip,
  type ClipId,
  type ClipSound,
  type ProjectState,
} from "@/modules/project";

const patch = z.object({
  volumeDb: volumeDbSchema.optional(),
  pan: panSchema.optional(),
  fadeIn: z.number().int().min(0).optional().describe("Microseconds"),
  fadeOut: z.number().int().min(0).optional().describe("Microseconds"),
  pitch: z
    .object({
      on: z.boolean(),
      semitones: z.number().int().min(-24).max(24),
      cents: z.number().int().min(-100).max(100),
    })
    .optional(),
  eq: eqSchema.optional(),
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

/** The sound paths of a patch that hold keys on a clip: those need a key, not a static value. */
function animatedPaths(clip: Clip, patch: Partial<ClipSound>): string[] {
  return ["volumeDb", "pan"]
    .filter((key) => patch[key as "volumeDb" | "pan"] !== undefined)
    .map((key) => `sound.${key}`)
    .filter((path) => clip.animation?.[path] !== undefined);
}

/** Drops the keys of sound values (every one under `sound.`, or just `paths`) from a clip. */
function dropKeys(clip: Clip, paths?: readonly string[]): void {
  if (!clip.animation) return;
  const kept = Object.entries(clip.animation).filter(([path]) =>
    paths ? !paths.includes(path) : !path.startsWith("sound."),
  );
  if (kept.length === Object.keys(clip.animation).length) return;
  if (kept.length > 0) clip.animation = Object.fromEntries(kept);
  else delete clip.animation;
}

function write(target: { sound?: ClipSound }, sound: ClipSound): void {
  const next = minimize(sound, DEFAULT_SOUND);
  if (next) target.sound = next;
  else delete target.sound;
}

/** Changes how clips sound. */
export const setSound = defineCommand({
  id: "audio.setSound",
  label: "Change sound",
  description:
    "Changes how clips sound: volumeDb (-60 to 12), pan (-1 left to 1 right), fadeIn and fadeOut (microseconds, kept within the clip), pitch { on, semitones, cents }, eq { on, bands } (always six: shape, hz, db, q, on). Passing the picture of a linked clip changes its sound clip. Fails with audio.no_sound. Set a whole pitch or eq object at a time. A volumeDb or pan that has keys fails with audio.animated: use keyframe_set to change it at a time, or audio_reset_sound to drop the keys.",
  undoable: true,
  input: z.object({ clipIds: z.array(z.string()).min(1), patch }),
  run(ctx, { clipIds, patch }) {
    const { store } = ctx.require(projectRef);
    const state = store.getState();
    const ids = soundClips(state, clipIds);
    for (const id of ids) {
      const animated = animatedPaths(state.clips[id]!, patch);
      if (animated.length > 0) {
        throw new CommandFailure(
          "audio.animated",
          `${animated.join(", ")} of clip "${id}" has keys. Use keyframe_set to change it at a time.`,
          { clipId: id, paths: animated },
        );
      }
    }
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
    'Puts clips\' sound back as the file has it. Pass section ("volume", "pan", "fades", "pitch" or "eq") to reset that part only. Keys of the reset values are removed too. Fails with audio.no_sound.',
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
          dropKeys(clip);
          continue;
        }
        if (section === "volume" || section === "pan") {
          dropKeys(clip, [`sound.${section === "volume" ? "volumeDb" : "pan"}`]);
        }
        const next = { ...soundOf(clip) } as Record<string, unknown>;
        for (const key of SECTIONS[section]!) next[key] = DEFAULT_SOUND[key];
        write(clip, next as unknown as ClipSound);
      }
    });
  },
});

export const audioCommands = [setSound, resetSound];

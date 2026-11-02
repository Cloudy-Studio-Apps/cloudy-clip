import type { KeyField, KeyTarget } from "@/modules/keyframe";
import { soundOf, type ClipSound } from "@/modules/project";
import { setSound } from "./audio.commands";

/** The values of a clip's sound that can be keyed, by the part of `ClipSound` they are. */
const KEYED: readonly { key: "volumeDb" | "pan"; label: string; min: number; max: number }[] = [
  { key: "volumeDb", label: "Volume", min: -60, max: 12 },
  { key: "pan", label: "Pan", min: -1, max: 1 },
];

/** The paths of a clip's sound that can hold keys: `sound.volumeDb` and `sound.pan`. */
export const KEYED_SOUND_PATHS: readonly string[] = KEYED.map(({ key }) => `sound.${key}`);

/** Volume and pan of clips on audio tracks, as keyable fields. The keys sit on the sound clip. */
export const audioKeys: KeyTarget = {
  id: "audio.keys",
  fields(_clip, track) {
    if (track.kind !== "audio") return [];
    return KEYED.map(({ key, label, min, max }): KeyField => ({
      path: `sound.${key}`,
      label,
      blend: "number",
      shared: true,
      min,
      max,
      read: (clip) => soundOf(clip)[key],
      commitStatic: (run, clipId, value) =>
        run.execute(setSound, {
          clipIds: [clipId],
          patch: { [key]: value } as Partial<Pick<ClipSound, "volumeDb" | "pan">>,
        }),
    }));
  },
};

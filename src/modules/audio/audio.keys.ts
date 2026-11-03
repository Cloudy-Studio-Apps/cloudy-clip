import type { KeyField, KeyTarget } from "@/modules/keyframe";
import { VOLUME_DB_MAX, VOLUME_DB_MIN, soundOf, type ClipSound } from "@/modules/project";
import { setSound } from "./audio.commands";
import type { KeyedSound } from "./audio.types";

/** The values of a clip's sound that can be keyed, by the part of `ClipSound` they are. */
const KEYED: readonly KeyedSound[] = [
  { key: "volumeDb", label: "Volume", min: VOLUME_DB_MIN, max: VOLUME_DB_MAX },
  { key: "pan", label: "Pan", min: -1, max: 1 },
];

/** Volume and pan of clips on audio tracks (not placed compositions), as keyable fields. The keys sit on the sound clip. */
export const audioKeys: KeyTarget = {
  id: "audio.keys",
  fields(clip, track) {
    // A composition placed in a track is mixed from its own clips; export has no envelope for it.
    if (track.kind !== "audio" || clip.compositionRef !== undefined) return [];
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

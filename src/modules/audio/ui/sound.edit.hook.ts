import { useMemo } from "react";
import { useKernel, useModule } from "@/core";
import type { InspectorContext } from "@/modules/inspector";
import { soundMember, useClipAtPlayhead } from "@/modules/inspector";
import { setKey } from "@/modules/keyframe";
import { previewRef } from "@/modules/preview";
import {
  animatedClip,
  clampToClip,
  projectRef,
  soundOf,
  type Clip,
  type ClipSound,
} from "@/modules/project";
import { resetSound, setSound } from "../audio.commands";
import type { SoundSection } from "../audio.types";

/** The values of a sound that can hold keys, by the path of their track. */
const KEYED = { volumeDb: "sound.volumeDb", pan: "sound.pan" } as const;

/** Stands in for the clip while there is none, so the hook order never changes. */
const NO_CLIP: Clip = {
  id: "",
  kind: "media",
  trackId: "",
  props: {},
  start: 0,
  sourceIn: 0,
  duration: 0,
};

/** Changes to a clip's sound: drag steps reach the preview only, the release is one command. */
export function useSoundEdit(context: InspectorContext) {
  const { bus } = useKernel();
  const preview = useModule(previewRef);
  const project = useModule(projectRef).store;
  const member = soundMember(context);
  const id = member?.clip.id;
  const shown = useClipAtPlayhead(member?.clip ?? NO_CLIP);
  const sound = member ? soundOf(shown) : undefined;
  const animation = member?.clip.animation;

  return useMemo(() => {
    const now = () => {
      const clip = id === undefined ? undefined : project.getState().clips[id];
      return clip
        ? soundOf(animatedClip(clip, clampToClip(clip, preview.playback.getTime())))
        : undefined;
    };
    return {
      sound,
      /** Whether a value of the sound has keys. */
      animated: (key: keyof typeof KEYED) => animation?.[KEYED[key]] !== undefined,
      live(patch: Partial<ClipSound>) {
        const current = now();
        if (id !== undefined && current) {
          preview.previewProps(id, { sound: { ...current, ...patch } });
        }
      },
      async commit(patch: Partial<ClipSound>) {
        if (id === undefined) return;
        const rest: Partial<ClipSound> = { ...patch };
        // A keyed value takes a key at the playhead, never a static value.
        for (const key of Object.keys(KEYED) as (keyof typeof KEYED)[]) {
          const value = rest[key];
          if (value === undefined || animation?.[KEYED[key]] === undefined) continue;
          delete rest[key];
          await bus.run(setKey, {
            clipId: id,
            path: KEYED[key],
            at: preview.playback.getTime(),
            value,
          });
        }
        if (Object.keys(rest).length > 0) await bus.run(setSound, { clipIds: [id], patch: rest });
        preview.previewProps(id, null);
      },
      reset(section: SoundSection) {
        if (id !== undefined) void bus.run(resetSound, { clipIds: [id], section });
      },
    };
  }, [animation, bus, id, preview, project, sound]);
}

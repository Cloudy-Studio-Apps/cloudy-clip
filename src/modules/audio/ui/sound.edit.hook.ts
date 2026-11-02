import { useMemo } from "react";
import { useKernel, useModule } from "@/core";
import type { InspectorContext } from "@/modules/inspector";
import { soundMember } from "@/modules/inspector";
import { previewRef } from "@/modules/preview";
import { projectRef, soundOf, type ClipSound } from "@/modules/project";
import { resetSound, setSound } from "../audio.commands";
import type { SoundSection } from "../audio.types";

/** Changes to a clip's sound: drag steps reach the preview only, the release is one command. */
export function useSoundEdit(context: InspectorContext) {
  const { bus } = useKernel();
  const preview = useModule(previewRef);
  const project = useModule(projectRef).store;
  const member = soundMember(context);
  const id = member?.clip.id;
  const sound = member ? soundOf(member.clip) : undefined;

  return useMemo(() => {
    const now = () => {
      const clip = id === undefined ? undefined : project.getState().clips[id];
      return clip ? soundOf(clip) : undefined;
    };
    return {
      sound,
      live(patch: Partial<ClipSound>) {
        const current = now();
        if (id !== undefined && current) {
          preview.previewProps(id, { sound: { ...current, ...patch } });
        }
      },
      async commit(patch: Partial<ClipSound>) {
        if (id === undefined) return;
        await bus.run(setSound, { clipIds: [id], patch });
        preview.previewProps(id, null);
      },
      reset(section: SoundSection) {
        if (id !== undefined) void bus.run(resetSound, { clipIds: [id], section });
      },
    };
  }, [bus, id, preview, project, sound]);
}

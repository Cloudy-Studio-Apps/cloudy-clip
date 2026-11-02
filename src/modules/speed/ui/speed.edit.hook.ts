import { useEffect, useMemo, useState } from "react";
import { useStore } from "zustand";
import { notify, useKernel, useModule } from "@/core";
import { previewRef } from "@/modules/preview";
import {
  junctionsOfClip,
  partnersOf,
  projectRef,
  sourceSpan,
  speedOf,
  type ClipId,
} from "@/modules/project";
import { timelineRef } from "@/modules/timeline";
import { resetSpeed, setSpeed } from "../speed.commands";
import { speedRef } from "../speed.ref";
import type { SpeedPatch } from "../speed.types";

/** Changes to a clip's speed: drag steps show live, the release is one command. */
export function useSpeedEdit(clipId: ClipId) {
  const { bus } = useKernel();
  const preview = useModule(previewRef);
  const project = useModule(projectRef).store;
  const timeline = useModule(timelineRef);
  const { view } = useModule(speedRef);
  const clip = useStore(project.api, (s) => s.clips[clipId]);
  const ripple = useStore(view, (s) => s.ripple);
  const joined = useStore(project.api, (s) =>
    junctionsOfClip(s, clipId).some((j) => j.leftClipId === clipId),
  );

  // Counts refusals, so the fields can go back from the value that was dragged.
  const [refused, setRefused] = useState(0);

  const edit = useMemo(() => {
    const group = () => {
      const state = project.getState();
      const own = state.clips[clipId];
      return own ? [own, ...partnersOf(state, clipId)] : [];
    };
    // Kept here, so a drag cut short still finds what it drew, even if the clip has gone.
    const drawn = new Set<ClipId>();
    const clear = () => {
      for (const id of drawn) {
        preview.previewProps(id, null);
        timeline.previewClipLength(id, null);
      }
      drawn.clear();
    };
    return {
      clear,
      live(rate: number) {
        for (const member of group()) {
          drawn.add(member.id);
          preview.previewProps(member.id, { speed: { ...speedOf(member), rate } });
          timeline.previewClipLength(member.id, sourceSpan(member) / rate);
        }
      },
      async commit(patch: SpeedPatch) {
        const result = await bus.run(setSpeed, {
          clipIds: [clipId],
          ...patch,
          ripple: view.getState().ripple,
        });
        clear();
        if (result.ok) return;
        notify("error", result.error.message);
        setRefused((count) => count + 1);
      },
      async reset() {
        const result = await bus.run(resetSpeed, {
          clipIds: [clipId],
          ripple: view.getState().ripple,
        });
        if (!result.ok) notify("error", result.error.message);
      },
      setRipple(next: boolean) {
        view.setState({ ripple: next });
      },
    };
  }, [bus, clipId, preview, project, timeline, view]);

  // Escape mid-drag closes the box with no release, so nothing else would clear it.
  useEffect(() => edit.clear, [edit]);

  return { clip, ripple, joined, refused, ...edit };
}

import { useMemo } from "react";
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
import { timelineRef, timeToPx } from "@/modules/timeline";
import { resetSpeed, setSpeed } from "../speed.commands";
import { speedRef } from "../speed.ref";

/** What can change besides the rate. */
interface SpeedPatch {
  rate?: number;
  duration?: number;
  pitchCorrection?: boolean;
}

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

  const edit = useMemo(() => {
    const group = () => {
      const state = project.getState();
      const own = state.clips[clipId];
      return own ? [own, ...partnersOf(state, clipId)] : [];
    };
    /** Draws the clips at a length, without the project knowing. */
    const widen = (length: (id: ClipId, duration: number) => number) => {
      const { pxPerSecond } = timeline.view.getState();
      for (const { id, duration } of group()) {
        const box = document.querySelector<HTMLElement>(`[data-clip-id="${id}"]`);
        if (box) box.style.width = `${timeToPx(length(id, duration), pxPerSecond)}px`;
      }
    };
    const clear = () => {
      for (const { id } of group()) preview.previewProps(id, null);
      widen((_id, duration) => duration);
    };
    return {
      live(rate: number) {
        for (const member of group()) {
          preview.previewProps(member.id, { speed: { ...speedOf(member), rate } });
        }
        widen((id) => {
          const member = project.getState().clips[id];
          return member ? sourceSpan(member) / rate : 0;
        });
      },
      async commit(patch: SpeedPatch) {
        const result = await bus.run(setSpeed, {
          clipIds: [clipId],
          ...patch,
          ripple: view.getState().ripple,
        });
        clear();
        if (!result.ok) notify("error", result.error.message);
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

  return { clip, ripple, joined, ...edit };
}

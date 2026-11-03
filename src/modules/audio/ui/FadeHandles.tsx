import { useRef } from "react";
import { useStore } from "zustand";
import { useKernel, useModule } from "@/core";
import { projectRef, soundOf, type Clip } from "@/modules/project";
import { timelineRef, timeToPx } from "@/modules/timeline";
import type { FadeEdge } from "../audio.types";
import { handleBoxes } from "../logic/fade";
import { Fade } from "./Fade";

/**
 * Over a clip of an audio track: the slope of each fade and a handle at the end of it to drag it.
 * The drag writes the slope and the handles with `style`; the release is one `audio.setSound`.
 */
export function FadeHandles({ clip, selected }: { clip: Clip; selected: boolean }) {
  const { bus } = useKernel();
  const kind = useStore(useModule(projectRef).store.api, (s) => s.tracks[clip.trackId]?.kind);
  const pxPerSecond = useStore(useModule(timelineRef).view, (s) => s.pxPerSecond);
  const handles = useRef<Record<FadeEdge, HTMLDivElement | null>>({ in: null, out: null });
  const sound = soundOf(clip);
  if (kind !== "audio") return null;
  const width = timeToPx(clip.duration, pxPerSecond);
  const boxesFor = (fadeIn: number, fadeOut: number) =>
    handleBoxes(width, timeToPx(fadeIn, pxPerSecond), timeToPx(fadeOut, pxPerSecond));
  const boxes = boxesFor(sound.fadeIn, sound.fadeOut);
  // The place of each handle depends on both fades: a drag moves both with `style`.
  const place = (fadeIn: number, fadeOut: number) => {
    const next = boxesFor(fadeIn, fadeOut);
    for (const edge of ["in", "out"] as const) {
      const element = handles.current[edge];
      if (!element) continue;
      element.style.left = `${next[edge].left}px`;
      element.style.width = `${next[edge].size}px`;
    }
  };
  const shared = { bus, clip, pxPerSecond, width, selected };
  return (
    <>
      <Fade
        edge="in"
        fade={sound.fadeIn}
        box={boxes.in}
        handleRef={(element) => void (handles.current.in = element)}
        onShow={(micros) => place(micros, sound.fadeOut)}
        {...shared}
      />
      <Fade
        edge="out"
        fade={sound.fadeOut}
        box={boxes.out}
        handleRef={(element) => void (handles.current.out = element)}
        onShow={(micros) => place(sound.fadeIn, micros)}
        {...shared}
      />
    </>
  );
}

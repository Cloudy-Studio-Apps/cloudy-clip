import { useStore } from "zustand";
import { useKernel, useModule } from "@/core";
import { projectRef, soundOf, type Clip } from "@/modules/project";
import { timelineRef, timeToPx } from "@/modules/timeline";
import { Fade } from "./Fade";

/**
 * Over a clip of an audio track: the slope of each fade and a handle at the top corner to drag it.
 * The drag writes the slope with `style`; the release is one `audio.setSound`.
 */
export function FadeHandles({ clip, selected }: { clip: Clip; selected: boolean }) {
  const { bus } = useKernel();
  const kind = useStore(useModule(projectRef).store.api, (s) => s.tracks[clip.trackId]?.kind);
  const pxPerSecond = useStore(useModule(timelineRef).view, (s) => s.pxPerSecond);
  const sound = soundOf(clip);
  if (kind !== "audio") return null;
  const width = timeToPx(clip.duration, pxPerSecond);
  const shared = { bus, clip, pxPerSecond, width, selected };
  return (
    <>
      <Fade edge="in" fade={sound.fadeIn} other={sound.fadeOut} {...shared} />
      <Fade edge="out" fade={sound.fadeOut} other={sound.fadeIn} {...shared} />
    </>
  );
}

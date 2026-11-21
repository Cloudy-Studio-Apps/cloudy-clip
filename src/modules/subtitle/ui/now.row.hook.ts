import { useEffect, useRef, type RefObject } from "react";
import type { Micros } from "@/core";
import type { PlaybackClock } from "@/modules/preview";
import type { Clip } from "@/modules/project";

/** The first cue (in list order) playing at a time. */
const cueAt = (cues: readonly Clip[], time: Micros) =>
  cues.find((c) => c.start <= time && time < c.start + c.duration)?.id;

/**
 * Marks the row of the cue under the playhead with `data-now`, from the playback clock and
 * straight on the DOM (no React render per frame). Marked again after each render of the list,
 * since scrolling draws other rows.
 */
export function useNowRow(
  listRef: RefObject<HTMLElement | null>,
  cues: readonly Clip[],
  playback: PlaybackClock,
): void {
  const cuesRef = useRef(cues);
  const markRef = useRef<(force: boolean) => void>(() => {});

  useEffect(() => {
    cuesRef.current = cues;
  }, [cues]);

  useEffect(() => {
    let last: string | undefined;
    const mark = (force: boolean) => {
      const list = listRef.current;
      const id = cueAt(cuesRef.current, playback.getTime());
      if (!list || (id === last && !force)) return;
      last = id;
      list.querySelector("[data-now]")?.removeAttribute("data-now");
      if (id) list.querySelector(`[data-cue="${id}"]`)?.setAttribute("data-now", "");
    };
    markRef.current = mark;
    const off = playback.onTime(() => mark(false));
    return () => {
      off();
      markRef.current = () => {};
    };
  }, [listRef, playback]);

  // After every render of the list: the rows drawn may have changed.
  useEffect(() => markRef.current(true));
}

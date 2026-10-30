import type { ActorId, Micros } from "@/core";
import type { PreviewApi } from "@/modules/preview";
import type { TimelineApi } from "@/modules/timeline";
import type { StoreApi } from "zustand/vanilla";
import type { CollabState } from "./collab.types";

/**
 * While `followed` is set, the user's playhead and timeline go where that agent's playhead goes.
 * Anything else moving the user's playhead is the user: scrubs call the clock directly, so they
 * never reach the bus, and any time but the one set here ends the following.
 */
export function startFollow(
  store: StoreApi<CollabState>,
  preview: PreviewApi,
  timeline: TimelineApi,
): () => void {
  const { playback } = preview;
  let stop: (() => void) | null = null;

  function follow(actor: ActorId): () => void {
    let expected: Micros | null = null;
    const unfollow = () => store.setState({ followed: null });
    const offAgent = preview.clockFor(actor).onTime((time) => {
      expected = time;
      playback.seek(time);
      timeline.scrollToTime(time);
    });
    const offUser = playback.onTime((time) => {
      if (time !== expected) unfollow();
    });
    const offPlaying = playback.onPlayingChange(() => {
      if (playback.isPlaying()) unfollow();
    });
    return () => {
      offAgent();
      offUser();
      offPlaying();
    };
  }

  const offStore = store.subscribe((state, previous) => {
    if (state.followed === previous.followed) return;
    stop?.();
    stop = state.followed === null ? null : follow(state.followed);
  });

  return () => {
    offStore();
    stop?.();
  };
}

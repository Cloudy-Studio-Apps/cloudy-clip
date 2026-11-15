import { LOCAL_ACTOR, type Micros } from "@/core";
import type { ClipId } from "@/modules/project";
import { clipUnder, holdsTime } from "./logic/strip";
import type { CurrentClip, FollowDeps } from "./tint.types";

/** The current clip's holder: what `TintApi.current`, `onCurrent` and `viewedAt` read. */
export function createCurrent(): CurrentClip {
  let current: ClipId | null = null;
  const listeners = new Set<(id: ClipId | null) => void>();
  const viewed = new Map<ClipId, Micros>();
  return {
    current: () => current,
    onCurrent(fn) {
      listeners.add(fn);
      return () => void listeners.delete(fn);
    },
    viewedAt: (clipId) => viewed.get(clipId),
    set(id) {
      if (id === current) return;
      current = id;
      for (const fn of [...listeners]) fn(id);
    },
    remember: (clipId, time) => void viewed.set(clipId, time),
  };
}

/**
 * Keeps the current clip right: the pinned clip until the playhead leaves it (or it goes), else
 * the gradeable clip under the playhead on the topmost visible video track. Remembers where the
 * playhead was in the current clip. Runs per frame without React. Returns the unsubscribe.
 */
export function followCurrent({ project, clock, view, holder }: FollowDeps): () => void {
  let lastTime: Micros | null = null;
  const update = (time: Micros) => {
    lastTime = time;
    const state = project.store.getState();
    const open = project.view.openFor(LOCAL_ACTOR);
    if (open === null) {
      holder.set(null);
      return;
    }
    const pinned = view.getState().pinned;
    if (pinned !== null && !holdsTime(state, open, pinned, time)) view.setState({ pinned: null });
    const id = view.getState().pinned ?? clipUnder(state, open, time);
    holder.set(id);
    if (id !== null) holder.remember(id, time);
  };
  const again = () => update(lastTime ?? clock.getTime());
  const offTime = clock.onTime(update);
  const offProject = project.store.subscribe(again);
  const offOpen = project.view.store.subscribe(again);
  const offPin = view.subscribe((now, before) => now.pinned !== before.pinned && again());
  return () => {
    offTime();
    offProject();
    offOpen();
    offPin();
  };
}

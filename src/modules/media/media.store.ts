import { createStore } from "zustand/vanilla";
import type { MediaId } from "@/modules/project";
import type { MediaProbe, MediaProbeState, ProxyInfo } from "./media.types";

/** Metadata of imported files. Ephemeral: not part of the undo history. */
export const mediaProbeStore = createStore<MediaProbeState>()(() => ({ probes: {} }));

/** Whether files from the OS are being dragged over the window. */
export const fileDropStore = createStore<{ active: boolean }>()(() => ({ active: false }));

/** Sets (or merges into) the probe of one media item. */
export function setProbe(id: MediaId, probe: Partial<MediaProbe>): void {
  mediaProbeStore.setState((state) => ({
    probes: {
      ...state.probes,
      [id]: { ...(state.probes[id] ?? { status: "pending" }), ...probe },
    },
  }));
}

/** Updates the proxy state of one media item. */
export function setProxy(id: MediaId, proxy: ProxyInfo): void {
  const previous = getProbe(id)?.proxy;
  // Keep the explanation from earlier events when progress events omit it.
  setProbe(id, { proxy: { ...proxy, message: proxy.message ?? previous?.message } });
}

/** Whether the proxy pipeline is done with a file (so its metadata can be read). */
export function isProxySettled(proxy: ProxyInfo | undefined): boolean {
  return proxy?.state === "ready" || proxy?.state === "skipped" || proxy?.state === "error";
}

/** Current probe of a media item, if any. */
export function getProbe(id: MediaId): MediaProbe | undefined {
  return mediaProbeStore.getState().probes[id];
}

/**
 * Resolves when the media has been probed (ready or error), or after `timeoutMs`.
 * Used by agents' tools so they get usable metadata in one call.
 */
export function waitForProbe(id: MediaId, timeoutMs = 15_000): Promise<MediaProbe | undefined> {
  const settled = (p: MediaProbe | undefined) => p && p.status !== "pending";
  const current = getProbe(id);
  if (settled(current)) return Promise.resolve(current);

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      unsubscribe();
      resolve(getProbe(id));
    }, timeoutMs);
    const unsubscribe = mediaProbeStore.subscribe((state) => {
      const probe = state.probes[id];
      if (settled(probe)) {
        clearTimeout(timer);
        unsubscribe();
        resolve(probe);
      }
    });
  });
}

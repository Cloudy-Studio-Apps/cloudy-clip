import { createStore } from "zustand/vanilla";
import type { MediaProbe, MediaProbeState, MediaState, ProxyInfo } from "./media.types";

/** Whether the proxy pipeline is done with a file (so its metadata can be read). */
export function isProxySettled(proxy: ProxyInfo | undefined): boolean {
  return proxy?.state === "ready" || proxy?.state === "skipped" || proxy?.state === "error";
}

/** Creates the media metadata state of one kernel. Ephemeral: not part of the undo history. */
export function createMediaState(): MediaState {
  const probes = createStore<MediaProbeState>()(() => ({ probes: {} }));
  const fileDrop = createStore<{ active: boolean }>()(() => ({ active: false }));
  const getProbe = (id: string): MediaProbe | undefined => probes.getState().probes[id];

  const setProbe: MediaState["setProbe"] = (id, probe) => {
    probes.setState((state) => ({
      probes: {
        ...state.probes,
        [id]: { ...(state.probes[id] ?? { status: "pending" }), ...probe },
      },
    }));
  };

  return {
    probes,
    fileDrop,
    getProbe,
    setProbe,
    setProxy(id, proxy) {
      const previous = getProbe(id)?.proxy;
      // Keep the explanation from earlier events when progress events omit it.
      setProbe(id, { proxy: { ...proxy, message: proxy.message ?? previous?.message } });
    },
    waitForProbe(id, timeoutMs = 15_000) {
      const settled = (p: MediaProbe | undefined) => p && p.status !== "pending";
      const current = getProbe(id);
      if (settled(current)) return Promise.resolve(current);

      return new Promise((resolve) => {
        const timer = setTimeout(() => {
          unsubscribe();
          resolve(getProbe(id));
        }, timeoutMs);
        const unsubscribe = probes.subscribe((state) => {
          const probe = state.probes[id];
          if (settled(probe)) {
            clearTimeout(timer);
            unsubscribe();
            resolve(probe);
          }
        });
      });
    },
  };
}

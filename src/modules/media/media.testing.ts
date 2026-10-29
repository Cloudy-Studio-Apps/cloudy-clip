import { defineModule } from "@/core";
import { elements } from "@/modules/element";
import { mediaElement } from "./media.element";
import { mediaRef } from "./media.ref";
import { createMediaState } from "./media.store";
import type { MediaProbe } from "./media.types";

/**
 * For tests: a media module with the given probes and no native calls. It uses the real
 * `mediaRef`, so modules that require media load against it. `mediaUrl` returns `fake://<id>`.
 */
export function createFakeMediaModule(probes: Record<string, MediaProbe>) {
  return defineModule({
    ref: mediaRef,
    name: "Media (fake)",
    tier: "core",
    requires: ["project"],
    // The element module is optional here so tests without it still load media.
    after: ["element"],
    setup({ contribute }) {
      contribute(elements, mediaElement);
      const state = createMediaState();
      state.probes.setState({ probes });
      return { api: { ...state, mediaUrl: (id: string) => `fake://${id}` } };
    },
  });
}

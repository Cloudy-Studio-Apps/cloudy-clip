import { mediaHasAudio, type MediaApi } from "@/modules/media";
import { denoiseNeeds, type ProjectState } from "@/modules/project";
import type { StoreApi } from "zustand/vanilla";
import { denoiseRequests } from "./logic/denoise";

/** How long the document and the probes stay still before the renderings follow them, in ms. */
const SETTLE_MS = 800;

/**
 * Keeps noise reduction's renderings in step with the document: a moment after it (or what's known
 * of the files) last changed, every file heard through noise reduction in any composition is
 * wanted, and only those, so a quick run of Amount or Floor changes renders the last one, and
 * queued renders of settings left behind are dropped. Returns a stop function.
 */
export function followDenoiseNeeds(
  project: StoreApi<ProjectState>,
  media: Pick<MediaApi, "probes" | "getProbe" | "wantDenoised">,
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const update = () => {
    const state = project.getState();
    const hasSound = (id: string) => mediaHasAudio(media.getProbe(id));
    const needs = Object.keys(state.compositions).flatMap((id) => denoiseNeeds(state, id));
    media.wantDenoised(denoiseRequests(needs, hasSound));
  };
  const later = () => {
    clearTimeout(timer);
    timer = setTimeout(update, SETTLE_MS);
  };
  const stops = [project.subscribe(later), media.probes.subscribe(later)];
  later();
  return () => {
    clearTimeout(timer);
    for (const stop of stops) stop();
  };
}

import { useMemo } from "react";
import { useStore } from "zustand";
import { useModule } from "@/core";
import { mediaHasAudio, mediaRef } from "@/modules/media";
import {
  denoiseNeeds,
  projectRef,
  type CompositionId,
  type DenoiseEffect,
} from "@/modules/project";
import { denoiseRequests } from "../logic/denoise";
import type { MixTarget } from "../sound.types";

/**
 * How far the files heard through a chain's noise reduction `effect` are rendered (`denoiseNeeds`,
 * the rule the preview and export follow): 0..1, the mean of those rendering or waiting their
 * turn, while any is; undefined otherwise. The renderings themselves follow the document
 * (`sound.denoise.follow.ts`).
 */
export function useDenoiseRendering(
  target: MixTarget,
  compositionId: CompositionId | undefined,
  effect: DenoiseEffect,
): number | undefined {
  const media = useModule(mediaRef);
  const project = useModule(projectRef).store;
  const jobs = useStore(media.denoising, (s) => s.jobs);
  const probes = useStore(media.probes, (s) => s.probes);
  const compositions = useStore(project.api, (s) => s.compositions);
  const tracks = useStore(project.api, (s) => s.tracks);
  const clips = useStore(project.api, (s) => s.clips);
  const assets = useStore(project.api, (s) => s.media);
  // A track's chain is heard where its composition plays; the master's in its own.
  const root = target === "master" ? compositionId : tracks[target]?.compositionId;

  const requests = useMemo(() => {
    if (root === undefined) return [];
    const state = { compositions, tracks, clips, media: assets };
    const mine = denoiseNeeds(state, root).filter((need) => need.denoise.id === effect.id);
    return denoiseRequests(mine, (id) => mediaHasAudio(probes[id]));
  }, [root, compositions, tracks, clips, assets, probes, effect.id]);

  return useMemo(() => {
    const rendering = jobs.filter((job) =>
      requests.some(
        (r) =>
          r.mediaId === job.mediaId &&
          r.amountDb === job.amountDb &&
          r.floorDb === job.floorDb &&
          r.reversed === job.reversed,
      ),
    );
    if (rendering.length === 0) return undefined;
    return rendering.reduce((sum, job) => sum + job.progress, 0) / rendering.length;
  }, [jobs, requests]);
}

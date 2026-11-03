import { useEffect, useMemo } from "react";
import { useStore } from "zustand";
import { useModule } from "@/core";
import { mediaHasAudio, mediaRef } from "@/modules/media";
import { projectRef, type CompositionId, type DenoiseEffect } from "@/modules/project";
import { heardMedia } from "../logic/effects";
import type { MixTarget } from "../sound.types";

/**
 * How far the files heard through a chain are rendered with its noise reduction `effect`: 0..1
 * (the mean of those rendering) while any is, undefined otherwise. While it's shown, files not yet
 * rendered with these settings start, so the preview and an export find them ready; until then
 * the originals play.
 */
export function useDenoiseRendering(
  target: MixTarget,
  compositionId: CompositionId | undefined,
  effect: DenoiseEffect,
): number | undefined {
  const media = useModule(mediaRef);
  const project = useModule(projectRef).store;
  const jobs = useStore(media.denoising, (s) => s.jobs);
  const state = useStore(project.api, (s) => s);
  const { on, amountDb, floorDb } = effect;

  const files = useMemo(
    () =>
      [...heardMedia(state, target, compositionId)].filter(
        (id) => state.media[id]?.kind !== "image" && mediaHasAudio(media.getProbe(id)),
      ),
    [state, target, compositionId, media],
  );

  useEffect(() => {
    if (!on || amountDb <= 0) return;
    // Asking for the URL starts a rendering not tried yet; one that failed was told, and isn't
    // tried again on each change of the document.
    for (const id of files) media.denoisedUrl(id, { amountDb, floorDb });
  }, [files, on, amountDb, floorDb, media]);

  return useMemo(() => {
    const mine = jobs.filter(
      (job) => job.amountDb === amountDb && job.floorDb === floorDb && files.includes(job.mediaId),
    );
    if (!on || mine.length === 0) return undefined;
    return mine.reduce((sum, job) => sum + job.progress, 0) / mine.length;
  }, [jobs, files, on, amountDb, floorDb]);
}

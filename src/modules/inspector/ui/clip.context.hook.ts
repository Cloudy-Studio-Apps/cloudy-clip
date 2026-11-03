import { useMemo } from "react";
import { useStore } from "zustand";
import { useModule } from "@/core";
import { partnersOf, projectRef, type ClipId } from "@/modules/project";
import type { InspectorContext } from "../inspector.types";

/** A clip with its track and its linked partner, the way a panel sees it; undefined once it's gone. */
export function useClipContext(clipId: ClipId): InspectorContext | undefined {
  const project = useModule(projectRef).store;
  const clip = useStore(project.api, (s) => s.clips[clipId]);
  const track = useStore(project.api, (s) => (clip ? s.tracks[clip.trackId] : undefined));
  const partnerClip = useStore(project.api, (s) => (clip ? partnersOf(s, clip.id)[0] : undefined));
  const partnerTrack = useStore(project.api, (s) =>
    partnerClip ? s.tracks[partnerClip.trackId] : undefined,
  );
  return useMemo<InspectorContext | undefined>(() => {
    if (!clip || !track) return undefined;
    const partner = partnerClip && partnerTrack && { clip: partnerClip, track: partnerTrack };
    return { clip, track, ...(partner && { partner }) };
  }, [clip, track, partnerClip, partnerTrack]);
}

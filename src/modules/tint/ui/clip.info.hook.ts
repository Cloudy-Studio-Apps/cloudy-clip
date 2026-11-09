import { useEffect, useState } from "react";
import { useStore } from "zustand";
import { useModule } from "@/core";
import { mediaRef } from "@/modules/media";
import { projectRef } from "@/modules/project";
import type { Clip } from "@/modules/project";

/** What a card shows about a clip beyond its place: a name, a poster, and codec and rate. */
export interface ClipInfo {
  name: string;
  poster: string | undefined;
  meta: string;
}

/** Name without its extension, for the strip. */
function bare(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}

/**
 * Reads a clip's file name (or composition name), poster and rate from the document and `media`'s
 * probes, and its codec from the file, once. The codec is blank until it is read (and where it
 * can't be, as outside the app).
 */
export function useClipInfo(clip: Clip): ClipInfo {
  const media = useModule(mediaRef);
  const project = useModule(projectRef);
  const mediaId = clip.mediaId;
  const asset = useStore(project.store.api, (s) => (mediaId ? s.media[mediaId] : undefined));
  const composition = useStore(project.store.api, (s) =>
    clip.compositionRef ? s.compositions[clip.compositionRef] : undefined,
  );
  const probe = useStore(media.probes, (s) => (mediaId ? s.probes[mediaId] : undefined));
  const [codec, setCodec] = useState<string>();
  useEffect(() => {
    if (!mediaId) return;
    let live = true;
    media.fileFacts(mediaId).then(
      (facts) => live && setCodec(facts?.videoCodec),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [media, mediaId]);

  const fps = composition?.format.fps ?? probe?.proxy?.meta?.fps;
  const kind = asset?.kind === "image" ? "Still" : composition ? "Composition" : codec;
  const rate = fps ? `${Number(fps.toFixed(2))}p` : undefined;
  return {
    name: composition?.name ?? (asset ? bare(asset.name) : "Clip"),
    poster: probe?.posterUrl,
    meta: [kind, rate].filter(Boolean).join(" · "),
  };
}

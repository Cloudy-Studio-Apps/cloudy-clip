import { useEffect, useState } from "react";
import { useModule } from "@/core";
import { mediaRef } from "../media.ref";
import type { FileFacts } from "../media.types";

/** What a file says about itself; empty until read, and when it can't be. */
export function useFileFacts(mediaId: string): FileFacts {
  const media = useModule(mediaRef);
  const [read, setRead] = useState<{ id: string; facts: FileFacts } | null>(null);
  useEffect(() => {
    let live = true;
    media.fileFacts(mediaId).then(
      (facts) => live && setRead({ id: mediaId, facts }),
      () => live && setRead({ id: mediaId, facts: {} }),
    );
    return () => {
      live = false;
    };
  }, [media, mediaId]);
  return read?.id === mediaId ? read.facts : {};
}

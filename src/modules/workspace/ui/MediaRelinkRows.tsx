import { useEffect, useMemo } from "react";
import { useStore } from "zustand";
import { useModule } from "@/core";
import { mediaRef, useLocateMedia } from "@/modules/media";
import { projectRef } from "@/modules/project";
import type { RelinkRowsProps } from "../workspace.types";
import { RelinkRow } from "./RelinkRow";

/** The media an opened project couldn't find, each with Locate. */
export function MediaRelinkRows({ onCount }: RelinkRowsProps) {
  const media = useModule(mediaRef);
  const { store } = useModule(projectRef);
  const probes = useStore(media.probes, (s) => s.probes);
  const assets = useStore(store.api, (s) => s.media);
  const locate = useLocateMedia();
  const missing = useMemo(
    () => Object.values(assets).filter(({ id }) => probes[id]?.status === "missing"),
    [assets, probes],
  );
  useEffect(() => onCount(missing.length), [missing.length, onCount]);
  return missing.map((asset) => (
    <RelinkRow
      key={asset.id}
      name={asset.name}
      path={asset.path}
      onLocate={() => void locate(asset)}
    />
  ));
}

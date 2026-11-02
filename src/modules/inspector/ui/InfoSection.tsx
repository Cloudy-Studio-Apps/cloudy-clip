import { useStore } from "zustand";
import { useModule } from "@/core";
import { projectRef } from "@/modules/project";
import { InfoList } from "@/ui";
import type { InspectorContext } from "../inspector.types";

/** The track a clip is on and the file it plays, when it has one. */
export function InfoSection({ context }: { context: InspectorContext }) {
  const { clip, track } = context;
  const media = useStore(useModule(projectRef).store.api, (s) =>
    clip.mediaId ? s.media[clip.mediaId] : undefined,
  );
  return (
    <InfoList
      rows={[
        { label: "Track", value: track.name },
        ...(clip.mediaId === undefined ? [] : [{ label: "File", value: media?.path ?? "—" }]),
      ]}
    />
  );
}

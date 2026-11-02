import { useStore } from "zustand";
import { formatTimecode, useModule } from "@/core";
import { projectRef } from "@/modules/project";
import { InfoList } from "@/ui";
import type { InspectorContext } from "../inspector.types";

/** Where a clip sits in time. An image and a clip without a file have no source time. */
export function TimingSection({ context }: { context: InspectorContext }) {
  const { clip } = context;
  const media = useStore(useModule(projectRef).store.api, (s) =>
    clip.mediaId ? s.media[clip.mediaId] : undefined,
  );
  const timed = clip.mediaId !== undefined && media?.kind !== "image";
  return (
    <InfoList
      rows={[
        { label: "Start", value: formatTimecode(clip.start) },
        { label: "End", value: formatTimecode(clip.start + clip.duration) },
        { label: "Duration", value: formatTimecode(clip.duration) },
        ...(timed ? [{ label: "Source in", value: formatTimecode(clip.sourceIn) }] : []),
      ]}
    />
  );
}

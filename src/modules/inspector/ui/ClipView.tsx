import { AudioLines, Film, Type } from "lucide-react";
import { useStore } from "zustand";
import { formatTimecode, microsToSeconds, useModule } from "@/core";
import { projectRef, type ClipId } from "@/modules/project";
import { cn } from "@/ui";
import { InfoList } from "./InfoList";
import { InspectorHeader } from "./InspectorHeader";
import { InspectorSection } from "./InspectorSection";
import { TransformSection } from "./TransformSection";

/** Details of one selected clip. */
export function ClipView({ clipId }: { clipId: ClipId }) {
  const project = useModule(projectRef).store;
  const clip = useStore(project.api, (s) => s.clips[clipId]);
  const track = useStore(project.api, (s) => (clip ? s.tracks[clip.trackId] : undefined));
  const media = useStore(project.api, (s) =>
    clip && clip.kind !== "text" ? s.media[clip.mediaId] : undefined,
  );
  if (!clip || !track) return null;

  const video = track.kind === "video";
  const text = clip.kind === "text";
  const KindIcon = text ? Type : video ? Film : AudioLines;
  const kindName = text ? "Text" : video ? "Video" : "Audio";

  return (
    <>
      <InspectorHeader
        badge={<KindIcon />}
        badgeClassName={cn(
          "text-white",
          text ? "bg-clip-type" : video ? "bg-clip-video" : "bg-clip-audio",
        )}
        title={text ? clip.text : (media?.name ?? "Missing media")}
        subtitle={`${kindName} · ${microsToSeconds(clip.duration).toFixed(1)}s`}
      />
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        {video && <TransformSection clip={clip} />}
        <InspectorSection title="Timing">
          <InfoList
            rows={[
              { label: "Start", value: formatTimecode(clip.start) },
              { label: "End", value: formatTimecode(clip.start + clip.duration) },
              { label: "Duration", value: formatTimecode(clip.duration) },
              // Text has no source file.
              ...(text ? [] : [{ label: "Source in", value: formatTimecode(clip.sourceIn) }]),
            ]}
          />
        </InspectorSection>
        <InspectorSection title="Info">
          <InfoList
            rows={[
              { label: "Track", value: track.name },
              ...(text ? [] : [{ label: "File", value: media?.path ?? "—" }]),
            ]}
          />
        </InspectorSection>
      </div>
    </>
  );
}

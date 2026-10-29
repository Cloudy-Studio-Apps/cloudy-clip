import { useStore } from "zustand";
import { formatTimecode, microsToSeconds, useModule, usePoint } from "@/core";
import { useMemo } from "react";
import { elementRef } from "@/modules/element";
import { projectRef, type ClipId } from "@/modules/project";
import { InfoList } from "@/ui";
import { inspectorSections } from "../inspector.points";
import { InspectorHeader } from "./InspectorHeader";
import { InspectorSection } from "./InspectorSection";

/** Details of one selected clip. */
export function ClipView({ clipId }: { clipId: ClipId }) {
  const project = useModule(projectRef).store;
  const clip = useStore(project.api, (s) => s.clips[clipId]);
  const track = useStore(project.api, (s) => (clip ? s.tracks[clip.trackId] : undefined));
  const media = useStore(project.api, (s) => (clip?.mediaId ? s.media[clip.mediaId] : undefined));
  const elements = useModule(elementRef);
  const contributed = usePoint(inspectorSections);
  const sections = useMemo(
    () =>
      track && clip
        ? contributed.filter((s) => s.appliesTo(clip, track)).sort((a, b) => a.order - b.order)
        : [],
    [contributed, clip, track],
  );
  if (!clip || !track) return null;

  const element = elements.get(clip.kind)?.definition;
  const display = element?.display(clip, { project: project.getState(), track });
  // Elements without a source file (text) have no source offset and no file.
  const sourceless = clip.mediaId === undefined;
  const kindName =
    element?.source === "media"
      ? track.kind === "video"
        ? "Video"
        : "Audio"
      : (element?.name ?? clip.kind);
  const KindIcon = display?.icon;

  return (
    <>
      <InspectorHeader
        badge={KindIcon && <KindIcon />}
        badgeClassName="text-white"
        badgeColor={display && `var(--${display.color})`}
        title={display?.label ?? clip.kind}
        subtitle={`${kindName} · ${microsToSeconds(clip.duration).toFixed(1)}s`}
      />
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        {sections.map(({ id, title, component: Body }) => (
          <InspectorSection key={id} title={title}>
            <Body clip={clip} />
          </InspectorSection>
        ))}
        <InspectorSection title="Timing">
          <InfoList
            rows={[
              { label: "Start", value: formatTimecode(clip.start) },
              { label: "End", value: formatTimecode(clip.start + clip.duration) },
              { label: "Duration", value: formatTimecode(clip.duration) },
              ...(sourceless ? [] : [{ label: "Source in", value: formatTimecode(clip.sourceIn) }]),
            ]}
          />
        </InspectorSection>
        <InspectorSection title="Info">
          <InfoList
            rows={[
              { label: "Track", value: track.name },
              ...(sourceless ? [] : [{ label: "File", value: media?.path ?? "—" }]),
            ]}
          />
        </InspectorSection>
      </div>
    </>
  );
}

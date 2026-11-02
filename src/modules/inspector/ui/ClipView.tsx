import { useMemo } from "react";
import { useStore } from "zustand";
import { microsToSeconds, useModule } from "@/core";
import { elementRef } from "@/modules/element";
import { partnersOf, projectRef, type ClipId } from "@/modules/project";
import { inspectorRef } from "../inspector.ref";
import type { InspectorContext } from "../inspector.types";
import { useClipPanel } from "./clip.panel.hook";
import { InspectorHeader } from "./InspectorHeader";
import { InspectorTabs } from "./InspectorTabs";
import { TabBody } from "./TabBody";
import { WarningRow } from "./WarningRow";

/** The panel of a clip: a header, the strip of tabs and the open tab's sections. */
function ClipPanelView({ context }: { context: InspectorContext }) {
  const project = useModule(projectRef).store;
  const elements = useModule(elementRef);
  const view = useModule(inspectorRef).view;
  const { clip, track } = context;
  const panel = useClipPanel(context);
  const media = useStore(project.api, (s) => (clip.mediaId ? s.media[clip.mediaId] : undefined));

  const element = elements.get(clip.kind)?.definition;
  const display = element?.display(clip, { project: project.getState(), track });
  const kindName =
    element?.source === "media"
      ? media?.kind === "image"
        ? "Image"
        : track.kind === "video"
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
      <InspectorTabs
        tabs={panel.tabs}
        active={panel.active}
        onPick={(id) => view.setTab(clip.kind, id)}
      />
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        {!element && (
          <div className="p-3">
            <WarningRow
              title="These clips can't be edited."
              detail={`No module provides "${clip.kind}" clips. Its plugin may be missing or turned off.`}
            />
          </div>
        )}
        <TabBody context={context} entries={panel.entries} />
      </div>
    </>
  );
}

/** Details of one selected clip, with its linked partner when it has one. */
export function ClipView({ clipId }: { clipId: ClipId }) {
  const project = useModule(projectRef).store;
  const clip = useStore(project.api, (s) => s.clips[clipId]);
  const track = useStore(project.api, (s) => (clip ? s.tracks[clip.trackId] : undefined));
  const partnerClip = useStore(project.api, (s) => (clip ? partnersOf(s, clip.id)[0] : undefined));
  const partnerTrack = useStore(project.api, (s) =>
    partnerClip ? s.tracks[partnerClip.trackId] : undefined,
  );
  const context = useMemo<InspectorContext | undefined>(() => {
    if (!clip || !track) return undefined;
    const partner = partnerClip && partnerTrack && { clip: partnerClip, track: partnerTrack };
    return { clip, track, ...(partner && { partner }) };
  }, [clip, track, partnerClip, partnerTrack]);
  if (!context) return null;
  return <ClipPanelView context={context} />;
}

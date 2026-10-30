import { memo, useEffect, useMemo, useRef } from "react";
import { useStore } from "zustand";
import { useModule, type Micros } from "@/core";
import { MEDIA_DROP, type MediaDragDetail } from "@/modules/media";
import { type Clip, type Track, projectRef } from "@/modules/project";
import { previewRef } from "@/modules/preview";
import { cn } from "@/ui";
import { timelineRef } from "../timeline.ref";
import { pxToTime } from "../logic/geometry";
import { snapCandidates, snapTime } from "../logic/placement";
import { SNAP_PX, trackHeight } from "../timeline.layout";
import { useTrackChips } from "../junction.display";
import { CutPreviewMark } from "./CutPreviewMark";
import { JunctionChip } from "./JunctionChip";
import { TimelineClip } from "./TimelineClip";

interface TrackLaneProps {
  track: Track;
  /** Clips of this track inside the rendered window. */
  clips: Clip[];
  pxPerSecond: number;
  /** The rendered window, in microseconds; chips outside it are not drawn. */
  from: Micros;
  to: Micros;
  rootRef: React.RefObject<HTMLDivElement | null>;
}

/** Time under a screen x coordinate, relative to a lane element. */
function timeAt(lane: HTMLElement, clientX: number, pxPerSecond: number): Micros {
  return Math.max(0, pxToTime(clientX - lane.getBoundingClientRect().left, pxPerSecond));
}

/** A track's lane: holds its clips, accepts media drops, and seeks on empty clicks. */
export const TrackLane = memo(function TrackLane({
  track,
  clips,
  pxPerSecond,
  from,
  to,
  rootRef,
}: TrackLaneProps) {
  const project = useModule(projectRef).store;
  const { playback } = useModule(previewRef);
  const timeline = useModule(timelineRef);
  const ref = useRef<HTMLDivElement>(null);
  const allChips = useTrackChips(track.id);
  const cutPreview = useStore(timeline.view, (s) =>
    s.cutPreview?.cut.trackId === track.id ? s.cutPreview : null,
  );
  const chips = useMemo(
    () => allChips.filter((c) => c.center >= from && c.center <= to),
    [allChips, from, to],
  );

  useEffect(() => {
    const lane = ref.current;
    if (!lane) return;
    const onDrop = (event: Event) => {
      event.stopPropagation();
      const { item, clientX } = (event as CustomEvent<MediaDragDetail>).detail;
      const state = project.getState();
      const media = item.type === "media" ? state.media[item.id] : undefined;
      const threshold = pxToTime(SNAP_PX, pxPerSecond);
      const start = snapTime(
        timeAt(lane, clientX, pxPerSecond),
        snapCandidates(state, track.compositionId, playback.getTime()),
        threshold,
      );
      // An audio file needs an audio lane; a video takes any lane (on an audio lane, its sound
      // lands there and its picture on a video track).
      const fits = media?.kind !== "audio" || track.kind === "audio";
      timeline.drop({ item, start, ...(fits && { trackId: track.id }) });
    };
    lane.addEventListener(MEDIA_DROP, onDrop);
    return () => lane.removeEventListener(MEDIA_DROP, onDrop);
  }, [playback, project, pxPerSecond, timeline, track.compositionId, track.id, track.kind]);

  return (
    <div
      ref={ref}
      data-track-id={track.id}
      className={cn("relative border-b border-border", cutPreview && "bg-primary-soft")}
      style={{ height: trackHeight(track.kind) }}
      onPointerDown={(e) => {
        if (e.button !== 0 || e.target !== e.currentTarget) return;
        timeline.selectClip(null);
        playback.seek(timeAt(e.currentTarget, e.clientX, pxPerSecond));
      }}
    >
      {clips.map((clip) => (
        <TimelineClip key={clip.id} clip={clip} pxPerSecond={pxPerSecond} rootRef={rootRef} />
      ))}
      {chips.map((chip) => (
        <JunctionChip key={chip.junction.id} chip={chip} pxPerSecond={pxPerSecond} />
      ))}
      {cutPreview && <CutPreviewMark preview={cutPreview} pxPerSecond={pxPerSecond} />}
    </div>
  );
});

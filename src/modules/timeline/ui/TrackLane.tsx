import { memo, useEffect, useRef } from "react";
import { useKernel, type Micros } from "@/core";
import { MEDIA_DROP, type MediaDragDetail } from "@/modules/media";
import { projectStore, type Clip, type Track } from "@/modules/project";
import { playback } from "@/modules/preview";
import { pxToTime } from "../logic/geometry";
import { snapCandidates, snapTime } from "../logic/placement";
import { addClip } from "../timeline.commands";
import { SNAP_PX, trackHeight } from "../timeline.layout";
import { selectClip } from "../timeline.store";
import { TimelineClip } from "./TimelineClip";

interface TrackLaneProps {
  track: Track;
  /** Clips of this track inside the rendered window. */
  clips: Clip[];
  pxPerSecond: number;
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
  rootRef,
}: TrackLaneProps) {
  const { bus } = useKernel();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const lane = ref.current;
    if (!lane) return;
    const onDrop = (event: Event) => {
      event.stopPropagation();
      const { mediaId, clientX } = (event as CustomEvent<MediaDragDetail>).detail;
      const state = projectStore.getState();
      const media = state.media[mediaId];
      if (!media) return;
      const threshold = pxToTime(SNAP_PX, pxPerSecond);
      const start = snapTime(
        timeAt(lane, clientX, pxPerSecond),
        snapCandidates(state, playback.getTime()),
        threshold,
      );
      void bus.run(addClip, {
        mediaId,
        start,
        trackId: media.kind === track.kind ? track.id : undefined,
      });
    };
    lane.addEventListener(MEDIA_DROP, onDrop);
    return () => lane.removeEventListener(MEDIA_DROP, onDrop);
  }, [bus, pxPerSecond, track.id, track.kind]);

  return (
    <div
      ref={ref}
      data-track-id={track.id}
      className={`relative border-b border-neutral-800 ${track.kind === "video" ? "bg-neutral-900" : "bg-neutral-900/60"}`}
      style={{ height: trackHeight(track.kind) }}
      onPointerDown={(e) => {
        if (e.button !== 0 || e.target !== e.currentTarget) return;
        selectClip(null);
        playback.seek(timeAt(e.currentTarget, e.clientX, pxPerSecond));
      }}
    >
      {clips.map((clip) => (
        <TimelineClip
          key={clip.id}
          clip={clip}
          kind={track.kind}
          pxPerSecond={pxPerSecond}
          rootRef={rootRef}
        />
      ))}
    </div>
  );
});

import { memo, useEffect, useRef } from "react";
import { useKernel, useModule, type Micros } from "@/core";
import { MEDIA_DROP, type MediaDragDetail } from "@/modules/media";
import { type Clip, type Track, projectRef } from "@/modules/project";
import { previewRef } from "@/modules/preview";
import { timelineRef } from "../timeline.ref";
import { pxToTime } from "../logic/geometry";
import { snapCandidates, snapTime } from "../logic/placement";
import { addClip } from "../timeline.commands";
import { SNAP_PX, trackHeight } from "../timeline.layout";
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
  const project = useModule(projectRef).store;
  const { playback } = useModule(previewRef);
  const timeline = useModule(timelineRef);
  const { bus } = useKernel();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const lane = ref.current;
    if (!lane) return;
    const onDrop = (event: Event) => {
      event.stopPropagation();
      const { mediaId, clientX } = (event as CustomEvent<MediaDragDetail>).detail;
      const state = project.getState();
      const media = state.media[mediaId];
      if (!media) return;
      const threshold = pxToTime(SNAP_PX, pxPerSecond);
      const start = snapTime(
        timeAt(lane, clientX, pxPerSecond),
        snapCandidates(state, playback.getTime()),
        threshold,
      );
      // An audio file needs an audio lane; a video takes any lane (on an audio lane, its sound
      // lands there and its picture on a video track).
      void bus.run(addClip, {
        mediaId,
        start,
        trackId: media.kind === "audio" && track.kind !== "audio" ? undefined : track.id,
      });
    };
    lane.addEventListener(MEDIA_DROP, onDrop);
    return () => lane.removeEventListener(MEDIA_DROP, onDrop);
  }, [bus, playback, project, pxPerSecond, track.id, track.kind]);

  return (
    <div
      ref={ref}
      data-track-id={track.id}
      className="relative border-b border-border"
      style={{ height: trackHeight(track.kind) }}
      onPointerDown={(e) => {
        if (e.button !== 0 || e.target !== e.currentTarget) return;
        timeline.selectClip(null);
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

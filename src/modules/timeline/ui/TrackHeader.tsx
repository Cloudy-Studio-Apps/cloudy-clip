import { AudioLines, Eye, EyeOff, Film, Volume2, VolumeX, X } from "lucide-react";
import { memo } from "react";
import { useKernel } from "@/core";
import type { Track } from "@/modules/project";
import { removeTrack, setTrackHidden, setTrackMuted } from "../timeline.commands";
import { trackHeight } from "../timeline.layout";
import { useHeaderWidth } from "./header.width.hook";
import { TrackButton } from "./TrackButton";

/** Name and controls of a track. Sticks to the left while scrolling horizontally. */
export const TrackHeader = memo(function TrackHeader({ track }: { track: Track }) {
  const { bus } = useKernel();
  const headerWidth = useHeaderWidth();
  const KindIcon = track.kind === "video" ? Film : AudioLines;

  return (
    <div
      className="sticky left-0 z-20 flex shrink-0 items-center gap-1.5 border-b border-r-[1.5px] border-b-border border-r-subtle-foreground bg-muted pl-2.5 pr-1.5"
      style={{ width: headerWidth, height: trackHeight(track.kind) }}
    >
      <KindIcon aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate font-mono text-[13px] font-bold text-muted-foreground">
        {track.name}
      </span>
      <div className="flex gap-0.5">
        {/* Video tracks are pictures only; sound is muted on its audio track. */}
        {track.kind === "audio" && (
          <TrackButton
            label={track.muted ? "Unmute track" : "Mute track"}
            off={track.muted}
            onClick={() => void bus.run(setTrackMuted, { trackId: track.id, muted: !track.muted })}
          >
            {track.muted ? <VolumeX /> : <Volume2 />}
          </TrackButton>
        )}
        {track.kind === "video" && (
          <TrackButton
            label={track.hidden ? "Show track" : "Hide track"}
            off={track.hidden}
            onClick={() =>
              void bus.run(setTrackHidden, { trackId: track.id, hidden: !track.hidden })
            }
          >
            {track.hidden ? <EyeOff /> : <Eye />}
          </TrackButton>
        )}
        <TrackButton
          label="Remove track"
          onClick={() => void bus.run(removeTrack, { trackId: track.id })}
        >
          <X />
        </TrackButton>
      </div>
    </div>
  );
});

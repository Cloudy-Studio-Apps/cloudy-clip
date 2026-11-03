import { X } from "lucide-react";
import { useKernel } from "@/core";
import type { Track } from "@/modules/project";
import { LetterToggle } from "@/ui";
import { removeTrack, setTrackMuted } from "../timeline.commands";
import { TrackButton } from "./TrackButton";
import { TrackControls } from "./TrackControls";

/**
 * A track header as an exposure sheet draws it (the sound scope): its code (`A1`) over two rows,
 * the name in hand, then M and the controls modules add (`timelineTrackControls`). Remove shows
 * on hover only.
 */
export function TrackHeaderSheet({ track, code }: { track: Track; code: string }) {
  const { bus } = useKernel();
  return (
    <div className="group/sheet grid h-full min-w-0 flex-1 grid-cols-[30px_minmax(0,1fr)] content-center gap-x-1 gap-y-[3px]">
      <span className="row-span-2 self-center font-mono text-md font-bold text-muted-foreground">
        {code}
      </span>
      <span className="truncate font-hand text-base font-bold text-foreground">{track.name}</span>
      <div className="flex items-center gap-0.5">
        <LetterToggle
          on={track.muted}
          label={track.muted ? "Unmute track" : "Mute track"}
          tone="mark"
          onToggle={() => void bus.run(setTrackMuted, { trackId: track.id, muted: !track.muted })}
        >
          M
        </LetterToggle>
        <TrackControls track={track} />
        <span className="ml-auto opacity-0 focus-within:opacity-100 group-hover/sheet:opacity-100">
          <TrackButton
            label="Remove track"
            onClick={() => void bus.run(removeTrack, { trackId: track.id })}
          >
            <X />
          </TrackButton>
        </span>
      </div>
    </div>
  );
}

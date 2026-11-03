import { AudioLines, Eye, EyeOff, Film, Volume2, VolumeX, X } from "lucide-react";
import { memo, useEffect, useRef } from "react";
import { useKernel } from "@/core";
import type { Track } from "@/modules/project";
import { cn } from "@/ui";
import { removeTrack, setTrackHidden, setTrackMuted } from "../timeline.commands";
import { trackHeight } from "../timeline.layout";
import { useHeaderWidth } from "./header.width.hook";
import { useTimelineScope } from "./scope.hook";
import { TrackButton } from "./TrackButton";
import { TrackControls } from "./TrackControls";
import { TrackHeaderSheet } from "./TrackHeaderSheet";
import { useTrackFocus } from "./track.focus.hook";

/**
 * Name and controls of a track. Sticks to the left while scrolling horizontally. On a page with a
 * track focus, the focused track's header is marked and kept in view, and a click focuses it. On
 * the sound scope it is drawn as the exposure sheet's (`TrackHeaderSheet`), headed by `code`.
 */
export const TrackHeader = memo(function TrackHeader({
  track,
  code,
}: {
  track: Track;
  /** The track's code on the sound scope (`A1`, by its place among the listed lanes). */
  code?: string;
}) {
  const { bus } = useKernel();
  const scope = useTimelineScope();
  const headerWidth = useHeaderWidth();
  const focus = useTrackFocus();
  const focused = focus?.selected === track.id;
  const ref = useRef<HTMLDivElement>(null);
  const KindIcon = track.kind === "video" ? Film : AudioLines;

  useEffect(() => {
    if (focused) ref.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [focused]);

  return (
    <div
      ref={ref}
      className={cn(
        "sticky left-0 z-20 flex shrink-0 items-center gap-1.5 border-b border-r-[1.5px] border-b-border border-r-subtle-foreground bg-muted",
        scope === "sound" ? "px-2" : "pl-2.5 pr-1.5",
        focused && "bg-surface shadow-[inset_2px_0_0_var(--mark)]",
      )}
      style={{ width: headerWidth, height: trackHeight(track.kind) }}
      onClick={
        focus
          ? (e) => {
              // Its buttons (mute, remove) act on the track without focusing it.
              if (!(e.target instanceof Element && e.target.closest("button"))) {
                focus.select(track.id);
              }
            }
          : undefined
      }
    >
      {scope === "sound" ? (
        <TrackHeaderSheet track={track} code={code ?? ""} />
      ) : (
        <>
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
                onClick={() =>
                  void bus.run(setTrackMuted, { trackId: track.id, muted: !track.muted })
                }
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
            <TrackControls track={track} />
            <TrackButton
              label="Remove track"
              onClick={() => void bus.run(removeTrack, { trackId: track.id })}
            >
              <X />
            </TrackButton>
          </div>
        </>
      )}
    </div>
  );
});

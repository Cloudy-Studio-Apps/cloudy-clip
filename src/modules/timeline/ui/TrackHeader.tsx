import { memo } from "react";
import { useKernel } from "@/core";
import type { Track } from "@/modules/project";
import { removeTrack, setTrackHidden, setTrackMuted } from "../timeline.commands";
import { HEADER_WIDTH, trackHeight } from "../timeline.layout";

function ToggleButton(props: {
  active: boolean;
  label: string;
  onClick(): void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-label={props.label}
      aria-pressed={props.active}
      title={props.label}
      className={`h-5 min-w-5 rounded px-1 text-[10px] ${
        props.active ? "bg-amber-500 text-black" : "text-neutral-400 hover:bg-neutral-700"
      }`}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  );
}

/** Name and controls of a track. Sticks to the left while scrolling horizontally. */
export const TrackHeader = memo(function TrackHeader({ track }: { track: Track }) {
  const { bus } = useKernel();
  return (
    <div
      className="sticky left-0 z-20 flex shrink-0 items-center gap-1 border-b border-r border-neutral-800 bg-neutral-900 px-2"
      style={{ width: HEADER_WIDTH, height: trackHeight(track.kind) }}
    >
      <span className="flex-1 truncate text-xs text-neutral-300">{track.name}</span>
      <ToggleButton
        active={track.muted}
        label={track.muted ? "Unmute track" : "Mute track"}
        onClick={() => void bus.run(setTrackMuted, { trackId: track.id, muted: !track.muted })}
      >
        M
      </ToggleButton>
      {track.kind === "video" && (
        <ToggleButton
          active={track.hidden}
          label={track.hidden ? "Show track" : "Hide track"}
          onClick={() => void bus.run(setTrackHidden, { trackId: track.id, hidden: !track.hidden })}
        >
          H
        </ToggleButton>
      )}
      <button
        type="button"
        aria-label="Remove track"
        title="Remove track"
        className="h-5 w-5 rounded text-xs text-neutral-500 hover:bg-neutral-700 hover:text-neutral-200"
        onClick={() => void bus.run(removeTrack, { trackId: track.id })}
      >
        ×
      </button>
    </div>
  );
});

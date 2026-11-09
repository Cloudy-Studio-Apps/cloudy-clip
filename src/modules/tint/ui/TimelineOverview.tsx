import { useEffect, useRef } from "react";
import { useModule } from "@/core";
import { useOpenComposition } from "@/modules/project";
import { previewRef } from "@/modules/preview";
import { cn } from "@/ui";
import { shortTime } from "../logic/strip";
import type { StripClip } from "../tint.types";
import { useCurrentClip } from "./current.hook";

/** Where each clip sits in the edit, one row per video track (V1 on top), with the playhead. */
export function TimelineOverview({ strip }: { strip: readonly StripClip[] }) {
  const { playback } = useModule(previewRef);
  const duration = useOpenComposition()?.duration ?? 0;
  const current = useCurrentClip();
  const playhead = useRef<HTMLElement>(null);
  const tracks = new Set(strip.map((entry) => entry.track)).size;
  const tight = tracks > 2;
  const share = (time: number) => `${duration > 0 ? (time / duration) * 100 : 0}%`;

  // The playhead moves through the DOM, never React state.
  useEffect(
    () =>
      playback.onTime((time) => {
        if (playhead.current) playhead.current.style.left = share(time);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [playback, duration],
  );

  return (
    <div
      title="Timeline overview: where each clip sits in the edit"
      className="relative mx-3 mt-0.5 mb-2.5 h-[22px] shrink-0 rounded-xs bg-background"
    >
      {strip.map(({ clip, track }) => {
        const row = Math.min(Number(track.slice(1)) - 1, 3);
        return (
          <i
            key={clip.id}
            className={cn(
              "absolute block rounded-[1px]",
              tight ? "h-1" : "h-1.5",
              clip.id === current ? "bg-primary" : "bg-border-strong",
            )}
            style={{
              top: 3 + row * (tight ? 5 : 9),
              left: share(clip.start),
              width: `max(2px, calc(${share(clip.duration)} - 2px))`,
            }}
          />
        );
      })}
      <b ref={playhead} className="absolute -inset-y-0.5 left-0 w-0.5 bg-mark" />
      <span className="absolute top-1 right-1.5 font-mono text-2xs text-subtle-foreground">
        {shortTime(duration)} · {strip.length} clips
      </span>
    </div>
  );
}

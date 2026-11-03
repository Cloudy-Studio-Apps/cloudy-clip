import { cn } from "@/ui";
import { DEMO_CLIPS, DEMO_CURRENT, DEMO_LENGTH } from "./demo/demo.clips";

/** Where each clip sits in the edit, on two rows (V2 above V1), with the playhead. */
export function TimelineOverview() {
  const share = (seconds: number) => `${(seconds / DEMO_LENGTH) * 100}%`;
  return (
    <div
      title="Timeline overview: where each clip sits in the edit"
      className="relative mx-3 mt-0.5 mb-2.5 h-[22px] shrink-0 rounded-xs bg-background"
    >
      {DEMO_CLIPS.map((clip) => (
        <i
          key={clip.id}
          className={cn(
            "absolute block h-1.5 rounded-[1px]",
            clip.track === "V2" ? "top-[3px]" : "top-[12px]",
            clip.id === DEMO_CURRENT ? "bg-primary" : "bg-border-strong",
          )}
          style={{ left: share(clip.from), width: `calc(${share(clip.to - clip.from)} - 2px)` }}
        />
      ))}
      <b className="absolute -inset-y-0.5 left-[15.5%] w-0.5 bg-mark" />
      <span className="absolute top-1 right-1.5 font-mono text-2xs text-subtle-foreground">
        0:{DEMO_LENGTH} · {DEMO_CLIPS.length} clips
      </span>
    </div>
  );
}

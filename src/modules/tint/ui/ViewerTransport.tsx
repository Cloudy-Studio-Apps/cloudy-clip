import { Camera, Play, Repeat, SkipBack, SkipForward } from "lucide-react";
import { IconButton } from "@/ui";
import { HeaderGap } from "./HeaderGap";

const nothing = () => {};

/** Timecode, previous/play/next clip, loop and Grab still. Not wired to playback yet. */
export function ViewerTransport() {
  return (
    <div className="flex h-10 shrink-0 items-center gap-1.5 border-t border-border px-3">
      <span className="mr-2 font-mono text-md font-bold">
        0:24<span className="text-sm font-normal text-subtle-foreground">.14</span>
      </span>
      <IconButton label="Previous clip (Up)" onClick={nothing}>
        <SkipBack />
      </IconButton>
      <IconButton label="Play (Space)" variant="solid" onClick={nothing}>
        <Play />
      </IconButton>
      <IconButton label="Next clip (Down)" onClick={nothing}>
        <SkipForward />
      </IconButton>
      <IconButton label="Loop: repeat the clip while you grade" active onClick={nothing}>
        <Repeat />
      </IconButton>
      <HeaderGap />
      <IconButton
        label="Grab still: save this frame and its grade to Looks (Ctrl+Alt+G)"
        onClick={nothing}
      >
        <Camera />
      </IconButton>
    </div>
  );
}

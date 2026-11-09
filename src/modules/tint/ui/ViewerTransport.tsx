import { Camera, Repeat, SkipBack, SkipForward } from "lucide-react";
import { useKernel, useModule } from "@/core";
import { PlayButton, Timecode } from "@/modules/preview";
import { IconButton } from "@/ui";
import { neighbourClip } from "../logic/strip";
import { tintRef } from "../tint.ref";
import { pinClip } from "../tint.view.commands";
import { HeaderGap } from "./HeaderGap";
import { useCurrentClip } from "./current.hook";
import { useStrip } from "./strip.hook";

const nothing = () => {};

/** Timecode, previous and next clip, play, loop and Grab still. Loop and Grab still aren't wired yet. */
export function ViewerTransport() {
  const { bus } = useKernel();
  const tint = useModule(tintRef);
  const strip = useStrip();
  const current = useCurrentClip();
  const go = (by: -1 | 1) => {
    const next = neighbourClip(strip, tint.current(), by);
    if (next) void bus.run(pinClip, { clipId: next.clip.id });
  };
  const index = strip.findIndex((entry) => entry.clip.id === current);
  return (
    <div className="flex h-10 shrink-0 items-center gap-1.5 border-t border-border px-3">
      <span className="mr-2 font-mono text-md font-bold">
        <Timecode compact />
      </span>
      <IconButton
        label="Previous clip"
        tip={{ text: "Grade the clip before this one in the strip.", keys: "Up" }}
        disabled={index === 0}
        onClick={() => go(-1)}
      >
        <SkipBack />
      </IconButton>
      <PlayButton />
      <IconButton
        label="Next clip"
        tip={{ text: "Grade the clip after this one in the strip.", keys: "Down" }}
        disabled={index >= 0 && index === strip.length - 1}
        onClick={() => go(1)}
      >
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

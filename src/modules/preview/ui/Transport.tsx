import { useEffect, useRef, useSyncExternalStore } from "react";
import { useStore } from "zustand";
import { formatTimecode, useKernel, useModule } from "@/core";
import { projectDuration, setFormat, type FormatPreset, projectRef } from "@/modules/project";
import { togglePlay } from "../preview.commands";
import { previewRef } from "../preview.ref";

const PRESETS: FormatPreset[] = ["9:16", "16:9", "1:1"];

function presetOf(width: number, height: number): FormatPreset {
  if (width === height) return "1:1";
  return width > height ? "16:9" : "9:16";
}

/** Play/pause, timecode, and format picker. The timecode updates without React renders. */
export function Transport() {
  const project = useModule(projectRef).store;
  const { playback } = useModule(previewRef);
  const { bus } = useKernel();
  const playing = useSyncExternalStore(playback.onPlayingChange, playback.isPlaying);
  const duration = useStore(project.api, projectDuration);
  const format = useStore(project.api, (s) => s.format);
  const timeRef = useRef<HTMLSpanElement>(null);

  useEffect(
    () =>
      playback.onTime((time) => {
        if (timeRef.current) timeRef.current.textContent = formatTimecode(time);
      }),
    [playback],
  );

  return (
    <div className="flex items-center gap-3 border-t border-neutral-800 px-3 py-2 text-xs">
      <button
        type="button"
        aria-label={playing ? "Pause" : "Play"}
        disabled={duration === 0}
        className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-100 text-neutral-900 hover:bg-white disabled:opacity-30"
        onClick={() => void bus.run(togglePlay, {})}
      >
        {playing ? "❚❚" : "▶"}
      </button>
      <span className="tabular-nums text-neutral-200">
        <span ref={timeRef}>00:00.00</span>
        <span className="text-neutral-500"> / {formatTimecode(duration)}</span>
      </span>
      <div className="ml-auto flex gap-1">
        {PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            className={`rounded px-2 py-0.5 ${
              presetOf(format.width, format.height) === preset
                ? "bg-neutral-700 text-white"
                : "text-neutral-400 hover:bg-neutral-800"
            }`}
            onClick={() => void bus.run(setFormat, { preset })}
          >
            {preset}
          </button>
        ))}
      </div>
    </div>
  );
}

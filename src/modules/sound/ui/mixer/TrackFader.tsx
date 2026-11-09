import { useCallback, type ReactNode } from "react";
import { useStore } from "zustand";
import { useModule } from "@/core";
import { previewRef } from "@/modules/preview";
import { projectRef, trackMixOf, type Track } from "@/modules/project";
import { clampDb, lineDb } from "../../logic/automation";
import type { HeardFeed } from "../../sound.types";
import { soundRef } from "../../sound.ref";
import { useAutomationFader } from "../lanes";
import { Fader } from "./Fader";

/**
 * A track's fader, through `useAutomationFader` (Read, Touch, Latch). With a volume line it is a
 * trim on the line, and a mark on the groove follows the line plus the trim at the playhead.
 */
export function TrackFader({ track, children }: { track: Track; children: ReactNode }) {
  const project = useModule(projectRef).store;
  const sound = useModule(soundRef);
  const { playback } = useModule(previewRef);
  const fader = useAutomationFader(track.id);
  // With a line, what's heard is the line at the playhead plus the fader's trim.
  const heard = useCallback<HeardFeed>(
    (draw) =>
      playback.onTime((time) => {
        const current = project.getState().tracks[track.id];
        const line = current?.mix?.volumeLine;
        if (current && line) draw(clampDb(lineDb(line, time) + trackMixOf(current).volumeDb));
      }),
    [playback, project, track.id],
  );
  // A pass ending puts the handle back on the saved level.
  const writing = useStore(sound.automation.state, (s) => s.writing.includes(track.id));
  return (
    <Fader
      value={writing ? fader.read() : trackMixOf(track).volumeDb}
      label={`${track.name} level`}
      offset={track.mix?.volumeLine !== undefined}
      heard={heard}
      {...fader}
    >
      {children}
    </Fader>
  );
}

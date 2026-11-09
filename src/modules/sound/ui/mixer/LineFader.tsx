import { useCallback, type ReactNode } from "react";
import { useStore } from "zustand";
import { useModule } from "@/core";
import { previewRef } from "@/modules/preview";
import { projectRef, type CompositionId } from "@/modules/project";
import { clampDb, lineDb, lineFader } from "../../logic/automation";
import type { HeardFeed, LineTarget } from "../../sound.types";
import { soundRef } from "../../sound.ref";
import { useAutomationFader } from "../lanes";
import { Fader } from "./Fader";

/**
 * The fader of a track or of the master of `compositionId`, through `useAutomationFader` (Read,
 * Touch, Latch). With a volume line it is a trim on the line, and a mark on the groove follows the
 * line plus the trim at the playhead.
 */
export function LineFader({
  target,
  compositionId,
  label,
  children,
}: {
  target: LineTarget;
  compositionId: CompositionId | undefined;
  label: string;
  children: ReactNode;
}) {
  const project = useModule(projectRef).store;
  const sound = useModule(soundRef);
  const { playback } = useModule(previewRef);
  const fader = useAutomationFader(target, compositionId);
  const where = compositionId ?? null;
  const volumeDb = useStore(project.api, (s) => lineFader(s, target, where)?.volumeDb ?? 0);
  const hasLine = useStore(project.api, (s) => lineFader(s, target, where)?.line !== undefined);
  // With a line, what's heard is the line at the playhead plus the fader's trim.
  const heard = useCallback<HeardFeed>(
    (draw) =>
      playback.onTime((time) => {
        const current = lineFader(project.getState(), target, where);
        if (current?.line) draw(clampDb(lineDb(current.line, time) + current.volumeDb));
      }),
    [playback, project, target, where],
  );
  // A pass ending puts the handle back on the saved level.
  const writing = useStore(sound.automation.state, (s) => s.writing.includes(target));
  return (
    <Fader
      value={writing ? fader.read() : volumeDb}
      label={label}
      offset={hasLine}
      heard={heard}
      {...fader}
    >
      {children}
    </Fader>
  );
}

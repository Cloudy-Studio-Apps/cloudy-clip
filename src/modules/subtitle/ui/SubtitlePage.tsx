import { useMemo } from "react";
import { useStore } from "zustand";
import { useModule } from "@/core";
import { projectRef, useOpenComposition } from "@/modules/project";
import { TimelinePanel } from "@/modules/timeline";
import { Kbd } from "@/ui";
import { cuesInOrder } from "../logic/srt";
import { CueList } from "./CueList";
import { SubtitleSide } from "./SubtitleSide";
import { SubtitleStage } from "./SubtitleStage";
import { SubtitleTransport } from "./SubtitleTransport";

/**
 * The Subtitles page: the transport row; the cue list, the real frame and the side panel; under
 * them the timeline on its subtitle scope (cue tracks only, with the picture and sound context
 * band). Mounted only while the page is open, so its stage takes the frames only then.
 */
export function SubtitlePage() {
  const project = useModule(projectRef).store;
  const id = useOpenComposition()?.id;
  const clips = useStore(project.api, (s) => s.clips);
  const tracks = useStore(project.api, (s) => s.tracks);
  const compositions = useStore(project.api, (s) => s.compositions);
  const cues = useMemo(
    () => (id ? cuesInOrder({ ...project.getState(), clips, tracks, compositions }, id) : []),
    [project, clips, tracks, compositions, id],
  );

  return (
    <div className="grid h-full grid-cols-[minmax(0,1fr)] grid-rows-[44px_minmax(0,1fr)_minmax(196px,34%)] bg-surface">
      <SubtitleTransport count={cues.length} />
      <div className="grid min-h-0 grid-cols-[380px_minmax(0,1fr)_330px] border-b border-border-strong">
        <section className="flex min-h-0 min-w-0 flex-col">
          <header className="flex h-[34px] shrink-0 items-center gap-2 border-b border-border-strong bg-muted pl-3 pr-2.5">
            <h3 className="font-hand text-base font-bold">Cues</h3>
            <span className="min-w-0 flex-1 truncate text-right font-mono text-xs text-muted-foreground">
              every subtitle in this composition
            </span>
          </header>
          <CueList cues={cues} />
          <p className="shrink-0 border-t border-dashed border-border-strong px-3 py-1.5 text-xs leading-relaxed text-subtle-foreground">
            In the words: <Kbd>Enter</Kbd> split · <Kbd>Shift+Enter</Kbd> new line · <Kbd>⌫</Kbd> at
            the start merges · <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> rows · <Kbd>Esc</Kbd> leave
            <br />
            Times: drag to nudge, click to type · a cue selected: <Kbd>[</Kbd> <Kbd>]</Kbd> start /
            end at the playhead · <Kbd>Alt+←</Kbd>
            <Kbd>Alt+→</Kbd> nudge the blue edge (<Kbd>Shift</Kbd>: the whole cue)
          </p>
        </section>
        <section className="flex min-h-0 min-w-0 border-x border-border-strong">
          <SubtitleStage />
        </section>
        <SubtitleSide />
      </div>
      <div className="min-h-0">
        <TimelinePanel scope="subtitle" />
      </div>
    </div>
  );
}

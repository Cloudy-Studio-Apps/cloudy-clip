import { Download, Plus, SkipBack, Undo2, Upload } from "lucide-react";
import { useHistory, useKernel, useModule } from "@/core";
import { PlayButton, previewRef, seek, Timecode } from "@/modules/preview";
import { IconButton, ToolbarButton, ToolbarSeparator } from "@/ui";
import { addCue } from "../subtitle.cue.commands";
import { subtitleRef } from "../subtitle.ref";
import { report } from "@/core";
import { exportFile, importFile } from "./subtitle.files";

/** How long a cue added with Add cue is: 2 s. */
const NEW_CUE = 2_000_000;

/**
 * The Subtitles page's transport row: the time, To start and Play; Add cue, Import and Export
 * .srt; the number of cues and Undo.
 */
export function SubtitleTransport({ count }: { count: number }) {
  const kernel = useKernel();
  const { bus } = kernel;
  const { playback } = useModule(previewRef);
  const { view } = useModule(subtitleRef);
  const history = useHistory();

  const add = async () => {
    const start = playback.getTime();
    const made = report(await bus.run(addCue, { start, duration: NEW_CUE, text: "New cue" }));
    if (made) view.setState({ focus: { clipId: made.clipId, caret: "all" } });
  };

  return (
    <div className="flex min-w-0 items-center gap-0.5 overflow-hidden border-b border-border-strong bg-surface px-3">
      <span className="mr-3 shrink-0">
        <Timecode compact />
      </span>
      <IconButton label="Go to start (Home)" onClick={() => void bus.run(seek, { time: 0 })}>
        <SkipBack />
      </IconButton>
      <span className="mx-1 inline-grid shrink-0">
        <PlayButton />
      </span>
      <ToolbarSeparator />
      <ToolbarButton icon={<Plus />} onClick={() => void add()}>
        Add cue
      </ToolbarButton>
      <ToolbarButton icon={<Download />} onClick={() => void importFile(kernel)}>
        Import .srt / .vtt
      </ToolbarButton>
      <ToolbarButton icon={<Upload />} onClick={() => void exportFile(kernel)}>
        Export .srt
      </ToolbarButton>
      <span className="min-w-0 flex-1" />
      <span className="shrink-0 whitespace-nowrap font-mono text-sm text-muted-foreground">
        {count === 1 ? "1 cue" : `${count} cues`}
      </span>
      <ToolbarSeparator />
      <IconButton
        label={history.undoLabel ? `Undo ${history.undoLabel} (Ctrl+Z)` : "Undo (Ctrl+Z)"}
        disabled={!history.canUndo}
        onClick={() => void bus.execute("history.undo", {})}
      >
        <Undo2 />
      </IconButton>
    </div>
  );
}

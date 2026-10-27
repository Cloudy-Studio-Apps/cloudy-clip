import { useStore } from "zustand";
import { useHistory, useKernel, useModule } from "@/core";
import { playback } from "@/modules/preview";
import { timelineRef } from "../timeline.ref";
import { addTrack, deleteClips, splitAt } from "../timeline.commands";
import { MAX_PX_PER_SECOND, MIN_PX_PER_SECOND } from "../timeline.store";

function ToolButton(props: {
  label: string;
  disabled?: boolean;
  onClick(): void;
  children: string;
}) {
  return (
    <button
      type="button"
      title={props.label}
      aria-label={props.label}
      disabled={props.disabled}
      className="rounded px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-800 disabled:opacity-30 disabled:hover:bg-transparent"
      onClick={props.onClick}
    >
      {props.children}
    </button>
  );
}

/** Edit actions and zoom. Every button runs a command, exactly like shortcuts and agents. */
export function TimelineToolbar() {
  const timeline = useModule(timelineRef);
  const { bus } = useKernel();
  const history = useHistory();
  const selection = useStore(timeline.view, (s) => s.selection);
  const pxPerSecond = useStore(timeline.view, (s) => s.pxPerSecond);

  // Log scale so the slider feels even from "whole hour" to "single frames".
  const toSlider = (pps: number) =>
    Math.log(pps / MIN_PX_PER_SECOND) / Math.log(MAX_PX_PER_SECOND / MIN_PX_PER_SECOND);
  const fromSlider = (v: number) =>
    MIN_PX_PER_SECOND * (MAX_PX_PER_SECOND / MIN_PX_PER_SECOND) ** v;

  return (
    <div className="flex items-center gap-1 border-b border-neutral-800 px-2 py-1">
      <ToolButton
        label={history.undoLabel ? `Undo ${history.undoLabel} (Ctrl+Z)` : "Undo (Ctrl+Z)"}
        disabled={!history.canUndo}
        onClick={() => void bus.execute("history.undo", {})}
      >
        ↶ Undo
      </ToolButton>
      <ToolButton
        label={
          history.redoLabel ? `Redo ${history.redoLabel} (Ctrl+Shift+Z)` : "Redo (Ctrl+Shift+Z)"
        }
        disabled={!history.canRedo}
        onClick={() => void bus.execute("history.redo", {})}
      >
        ↷ Redo
      </ToolButton>
      <span className="mx-1 h-4 w-px bg-neutral-800" />
      <ToolButton
        label="Split at playhead (S)"
        onClick={() =>
          void bus.run(splitAt, {
            at: playback.getTime(),
            clipIds: selection.length > 0 ? selection : undefined,
          })
        }
      >
        Split
      </ToolButton>
      <ToolButton
        label="Delete selected (Delete)"
        disabled={selection.length === 0}
        onClick={() => void bus.run(deleteClips, { clipIds: selection })}
      >
        Delete
      </ToolButton>
      <span className="mx-1 h-4 w-px bg-neutral-800" />
      <ToolButton label="Add video track" onClick={() => void bus.run(addTrack, { kind: "video" })}>
        + Video track
      </ToolButton>
      <ToolButton label="Add audio track" onClick={() => void bus.run(addTrack, { kind: "audio" })}>
        + Audio track
      </ToolButton>
      <label className="ml-auto flex items-center gap-2 text-xs text-neutral-500">
        Zoom
        <input
          type="range"
          min={0}
          max={1}
          step={0.001}
          value={toSlider(pxPerSecond)}
          onChange={(e) => timeline.setZoom(fromSlider(Number(e.currentTarget.value)))}
          className="w-32 accent-sky-500"
        />
      </label>
    </div>
  );
}

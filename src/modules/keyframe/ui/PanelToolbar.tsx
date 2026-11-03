import {
  ClipboardPaste,
  Copy,
  Diamond,
  Layers,
  Maximize2,
  Minimize2,
  MousePointerSquareDashed,
  Route,
  ScanSearch,
  Spline,
} from "lucide-react";
import { useStore } from "zustand";
import { useKernel, useModule } from "@/core";
import { previewRef } from "@/modules/preview";
import { projectRef } from "@/modules/project";
import { timelineRef } from "@/modules/timeline";
import { ToolbarButton } from "@/ui";
import { PANEL_TOOLBAR_HEIGHT } from "../keyframe.layout";
import { keyframeRef } from "../keyframe.ref";
import { setEase } from "../keyframe.ease.commands";
import { setKeys } from "../keyframe.edit.commands";
import { allSmooth, smoothChanges } from "../logic/handles";
import type { PanelClip } from "../keyframe.types";
import type { PanelActions } from "../keyframe.types";
import { report } from "./panel.actions.hook";

/** The row Add key works on: the primary one when it is listed, else the first. */
function targetRow(rows: readonly PanelClip[], primary: string | null) {
  const listed = rows.flatMap(({ clip, fields }) =>
    fields.map((field) => ({ clipId: clip.id, path: field.path })),
  );
  return listed.find((row) => `${row.clipId}:${row.path}` === primary) ?? listed[0];
}

/** Under the divider: what the panel lists, adding a key, and giving the tracks back or taking them. */
export function PanelToolbar({
  rows,
  actions,
}: {
  rows: readonly PanelClip[];
  actions: PanelActions;
}) {
  const { bus } = useKernel();
  const { playback } = useModule(previewRef);
  const timeline = useModule(timelineRef);
  const { view } = useModule(keyframeRef);
  const scope = useStore(view, (s) => s.scope);
  const primary = useStore(view, (s) => s.primary);
  const maximized = useStore(view, (s) => s.maximized);
  const motionPath = useStore(view, (s) => s.motionPath);
  const selectedCount = useStore(view, (s) => s.selection.length);
  const target = targetRow(rows, primary);
  const project = useModule(projectRef).store;

  const smooth = () => {
    const { clips } = project.api.getState();
    const selection = view.getState().selection;
    const changes = smoothChanges(clips, selection, !allSmooth(clips, selection));
    if (changes.length > 0) void bus.run(setEase, { changes }).then(report);
  };

  const maximize = (next: boolean) => {
    view.setState({ maximized: next });
    timeline.setTracksHidden(next);
  };

  return (
    <div
      className="flex shrink-0 items-center gap-1 border-b border-border-strong bg-muted px-2"
      style={{ height: PANEL_TOOLBAR_HEIGHT }}
    >
      <ToolbarButton
        icon={<Layers />}
        title="Which clips the panel lists"
        onClick={() => view.setState({ scope: scope === "all" ? "selected" : "all" })}
      >
        {scope === "all" ? "Showing: all animated" : "Showing: selected clips"}
      </ToolbarButton>
      <ToolbarButton
        icon={<Diamond />}
        title="Add a key at the playhead on the highlighted row"
        disabled={!target}
        onClick={() =>
          target &&
          void bus.run(setKeys, {
            clipId: target.clipId,
            paths: [target.path],
            at: playback.getTime(),
          })
        }
      >
        Add key at playhead
      </ToolbarButton>
      <ToolbarButton
        icon={<Spline />}
        title="Turn the selected keys' linear segments into curves with handles, and keep the handles on both sides of each key in line"
        disabled={selectedCount === 0}
        onClick={smooth}
      >
        Smooth handles
      </ToolbarButton>
      <ToolbarButton
        icon={<Copy />}
        title="Copy the selected keys"
        disabled={selectedCount === 0}
        onClick={actions.copy}
      >
        Copy
      </ToolbarButton>
      <ToolbarButton
        icon={<ClipboardPaste />}
        title="Paste the copied keys onto the selected clips at the playhead"
        onClick={actions.paste}
      >
        Paste
      </ToolbarButton>
      <ToolbarButton
        icon={<MousePointerSquareDashed />}
        title="Select every key the panel lists"
        disabled={rows.length === 0}
        onClick={actions.selectAll}
      >
        Select all keys
      </ToolbarButton>
      <ToolbarButton
        icon={<ScanSearch />}
        title="Zoom the timeline to the listed clips"
        disabled={rows.length === 0}
        onClick={actions.fit}
      >
        Fit
      </ToolbarButton>
      <ToolbarButton
        icon={<Route />}
        title="Draw the selected clip's position path on the canvas, with its keys to drag"
        aria-pressed={motionPath}
        className={motionPath ? "text-on" : undefined}
        onClick={() => view.setState({ motionPath: !motionPath })}
      >
        Motion path
      </ToolbarButton>
      <div className="min-w-3 flex-1" />
      <ToolbarButton
        icon={maximized ? <Minimize2 /> : <Maximize2 />}
        title={maximized ? "Show the tracks again" : "Give the panel the whole timeline area"}
        onClick={() => maximize(!maximized)}
      >
        {maximized ? "Restore tracks" : "Maximize"}
      </ToolbarButton>
    </div>
  );
}

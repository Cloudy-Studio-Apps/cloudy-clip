import { Diamond, Layers, Maximize2, Minimize2 } from "lucide-react";
import { useStore } from "zustand";
import { useKernel, useModule } from "@/core";
import { previewRef } from "@/modules/preview";
import { timelineRef } from "@/modules/timeline";
import { ToolbarButton } from "@/ui";
import { PANEL_TOOLBAR_HEIGHT } from "../keyframe.layout";
import { keyframeRef } from "../keyframe.ref";
import { setKeys } from "../keyframe.edit.commands";
import type { PanelClip } from "../keyframe.types";

/** The row Add key works on: the primary one when it is listed, else the first. */
function targetRow(rows: readonly PanelClip[], primary: string | null) {
  const listed = rows.flatMap(({ clip, fields }) =>
    fields.map((field) => ({ clipId: clip.id, path: field.path })),
  );
  return listed.find((row) => `${row.clipId}:${row.path}` === primary) ?? listed[0];
}

/** Under the divider: what the panel lists, adding a key, and giving the tracks back or taking them. */
export function PanelToolbar({ rows }: { rows: readonly PanelClip[] }) {
  const { bus } = useKernel();
  const { playback } = useModule(previewRef);
  const timeline = useModule(timelineRef);
  const { view } = useModule(keyframeRef);
  const scope = useStore(view, (s) => s.scope);
  const primary = useStore(view, (s) => s.primary);
  const maximized = useStore(view, (s) => s.maximized);
  const target = targetRow(rows, primary);

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

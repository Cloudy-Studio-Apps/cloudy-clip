import { useMemo, useState } from "react";
import { DEFAULT_CORRECTION } from "@/modules/project";
import { Button } from "@/ui";
import { useToolEdit } from "../tool.edit.hook";
import { GradeSlider } from "./GradeSlider";
import { ToolColumn } from "./ToolColumn";
import type { WarperEdit } from "./tools.types";
import { WarperGrid } from "./WarperGrid";
import type { Warper } from "../../tint.types";

/** Warper: a grid of points over hue and strength on the selected correction; drag one to bend that color. */
export function WarperTool() {
  const { values, edit } = useToolEdit();
  const warper = values.warper;
  const [pinning, setPinning] = useState(false);
  const patch = (next: Warper) => ({ values: { warper: next } });

  const warperEdit = useMemo(
    (): WarperEdit => ({
      preview: (next) => edit.preview({ values: { warper: next } }),
      commit: (next) => void edit.commit({ values: { warper: next } }),
      cancel: edit.cancel,
    }),
    [edit],
  );

  return (
    <div key={edit.rev} className="grid grid-cols-[232px_minmax(240px,360px)] items-start gap-11">
      <WarperGrid warper={warper} pinning={pinning} edit={edit.enabled ? warperEdit : undefined} />
      <ToolColumn
        title="Warper"
        info="Each point is a color: around the circle is hue, out from the middle is strength. Drag a point toward another hue to shift that color, or in and out to change its strength. Neighbors follow by Smoothing; pinned points stay."
      >
        <GradeSlider
          path="warper.smoothing"
          label="Smoothing"
          step={1}
          value={warper.smoothing}
          resetTo={DEFAULT_CORRECTION.warper.smoothing}
          edit={edit}
          patch={(smoothing) => patch({ ...warper, smoothing })}
        />
        <div className="mt-3 flex gap-2">
          <Button
            size="sm"
            disabled={!edit.enabled}
            aria-pressed={pinning}
            title={
              pinning
                ? "Click points to pin or unpin them; click Pin again to drag"
                : "Pin: lock points so dragging others leaves them alone"
            }
            onClick={() => setPinning(!pinning)}
          >
            {pinning ? "Pinning…" : "Pin"}
          </Button>
          <Button
            size="sm"
            disabled={!edit.enabled || Object.keys(warper.points).length === 0}
            title="Reset: put every point back (pins stay)"
            onClick={() => void edit.commit(patch({ ...warper, points: {} }))}
          >
            Reset
          </Button>
        </div>
      </ToolColumn>
    </div>
  );
}

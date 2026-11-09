import { useEffect } from "react";
import { useLimitEdit } from "../limit.edit.hook";
import { useTintView } from "../view.hook";
import { useTintSet } from "../view.set.hook";
import { LimitBrightness } from "./LimitBrightness";
import { LimitColor } from "./LimitColor";
import { LimitRefine } from "./LimitRefine";
import { LimitShared } from "./LimitShared";
import { ToolColumns } from "./ToolColumns";

/**
 * Limit: change only the colors picked, or a band of brightness, on the selected correction, or
 * use the pick of a correction above (`LimitShared`; then only Show and Invert stay).
 * Without a limit, the whole frame. Show follows the layer being edited and goes with the tool.
 */
export function LimitTool() {
  const edit = useLimitEdit();
  const showPicked = useTintView((v) => v.showPicked);
  const set = useTintSet();

  // Show shows the layer being edited: another layer selected, it shows that one.
  useEffect(() => {
    if (showPicked !== null && showPicked !== edit.nodeId) set({ showPicked: edit.nodeId });
  }, [showPicked, edit.nodeId, set]);

  // Leaving the tool stops a pick that hasn't happened, and Show.
  useEffect(() => () => set({ picking: false, showPicked: null }), [set]);

  const shared = edit.limit?.from !== undefined;
  return (
    <div key={edit.rev}>
      <LimitShared edit={edit} />
      <ToolColumns>
        {!shared && <LimitColor edit={edit} />}
        {!shared && <LimitBrightness edit={edit} />}
        <LimitRefine edit={edit} shared={shared} />
      </ToolColumns>
    </div>
  );
}

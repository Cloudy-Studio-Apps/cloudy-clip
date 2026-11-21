import { PreviewStage } from "@/modules/preview";
import { CuePicker } from "./CuePicker";

/**
 * The real frame with every track, and no canvas tools (`PreviewStage bare`). A click selects the
 * top-most cue under the pointer, a double-click puts the cursor in its row.
 */
export function SubtitleStage() {
  return (
    <PreviewStage bare>
      <CuePicker />
    </PreviewStage>
  );
}

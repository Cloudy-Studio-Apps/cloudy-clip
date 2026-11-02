import { useMemo, type RefObject } from "react";
import {
  MICROS_PER_SECOND,
  notify,
  useKernel,
  useModule,
  type AppError,
  type Result,
} from "@/core";
import { previewRef } from "@/modules/preview";
import { clipEnd } from "@/modules/project";
import { timelineRef, timeToPx } from "@/modules/timeline";
import { copyKeys, pasteKeys } from "../keyframe.clipboard.commands";
import { removeKeys } from "../keyframe.edit.commands";
import { PANEL_HEADER_WIDTH } from "../keyframe.layout";
import { keyframeRef } from "../keyframe.ref";
import type { KeyRef, PanelClip } from "../keyframe.types";

/** Room left around the clips when Fit zooms to them, in px. */
const FIT_MARGIN = 24;

/** What the panel's buttons and keys do to the key selection. Each reports a failure with `notify`. */
export interface PanelActions {
  copy(): void;
  paste(): void;
  remove(): void;
  selectAll(): void;
  fit(): void;
}

/** The panel's actions over the keys it lists. Commands run on the bus; the view only selects. */
export function usePanelActions(
  rows: readonly PanelClip[],
  root: RefObject<HTMLElement | null>,
): PanelActions {
  const { bus } = useKernel();
  const { view } = useModule(keyframeRef);
  const { playback } = useModule(previewRef);
  const timeline = useModule(timelineRef);

  return useMemo(() => {
    const report = (result: Result<unknown, AppError>) => {
      if (!result.ok) notify("error", result.error.message);
    };
    const selected = () => view.getState().selection;
    return {
      copy() {
        const keys = selected();
        if (keys.length > 0) void bus.run(copyKeys, { keys }).then(report);
      },
      paste() {
        const clipIds = timeline.view.getState().selection;
        if (clipIds.length === 0) return notify("info", "Select a clip to paste the keys onto.");
        void bus.run(pasteKeys, { at: playback.getTime(), clipIds }).then(report);
      },
      remove() {
        const keys = selected();
        if (keys.length > 0) void bus.run(removeKeys, { keys }).then(report);
      },
      selectAll() {
        const all: KeyRef[] = rows.flatMap(({ clip, fields }) =>
          fields.flatMap(({ path }) =>
            (clip.animation?.[path]?.keys ?? []).map((key) => ({
              clipId: clip.id,
              path,
              keyId: key.id,
            })),
          ),
        );
        view.setState({ selection: all });
      },
      fit() {
        const panel = root.current;
        if (!panel || rows.length === 0) return;
        const start = Math.min(...rows.map(({ clip }) => clip.start));
        const end = Math.max(...rows.map(({ clip }) => clipEnd(clip)));
        const room = panel.clientWidth - PANEL_HEADER_WIDTH - FIT_MARGIN * 2;
        if (room <= 0 || end <= start) return;
        timeline.setZoom((room / (end - start)) * MICROS_PER_SECOND);
        const zoom = timeline.view.getState().pxPerSecond;
        timeline.setScrollLeft(Math.max(0, timeToPx(start, zoom) - FIT_MARGIN));
      },
    };
  }, [bus, view, playback, timeline, rows, root]);
}

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
import { clipEnd, projectRef } from "@/modules/project";
import { clipsInScope, timelineRef, timeToPx, useTimelineScope } from "@/modules/timeline";
import { copyKeys, pasteKeys } from "../keyframe.clipboard.commands";
import { setEase, scaleKeys } from "../keyframe.ease.commands";
import { removeKeys } from "../keyframe.edit.commands";
import { PANEL_HEADER_WIDTH } from "../keyframe.layout";
import { keyframeRef } from "../keyframe.ref";
import type { KeyActions, KeyRef, PanelActions, PanelClip } from "../keyframe.types";
import { selectionSpan } from "../logic/stretch";

/** Room left around the clips when Fit zooms to them, in px. */
const FIT_MARGIN = 24;

/** Tells the user when a command failed (rule 32). */
export function report(result: Result<unknown, AppError>): void {
  if (!result.ok) notify("error", result.error.message);
}

/** The actions on the selected keys, for the panel and the menus. Commands run on the bus. */
export function useKeyActions(): KeyActions {
  const { bus } = useKernel();
  const { view } = useModule(keyframeRef);
  const project = useModule(projectRef).store;

  return useMemo(() => {
    const selected = () => view.getState().selection;
    return {
      copy() {
        const keys = selected();
        if (keys.length > 0) void bus.run(copyKeys, { keys }).then(report);
      },
      remove() {
        const keys = selected();
        if (keys.length > 0) void bus.run(removeKeys, { keys }).then(report);
      },
      reverse() {
        const keys = selected();
        const span = selectionSpan(project.getState().clips, keys);
        if (!span) return;
        const pivot = Math.round((span.start + span.end) / 2);
        void bus.run(scaleKeys, { keys, pivot, factor: -1 }).then(report);
      },
      ease(id) {
        const keys = selected();
        if (keys.length > 0) {
          void bus.run(setEase, { changes: keys.map((key) => ({ key, ease: id })) }).then(report);
        }
      },
    };
  }, [bus, view, project]);
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
  const project = useModule(projectRef).store;
  const scope = useTimelineScope();
  const keyActions = useKeyActions();

  return useMemo(() => {
    return {
      ...keyActions,
      paste() {
        // Onto the selected clips this timeline may touch: on a sound-scope one, no picture.
        const state = project.getState();
        const selected = timeline.view.getState().selection.flatMap((id) => state.clips[id] ?? []);
        const clipIds = clipsInScope(state, selected, scope).map((clip) => clip.id);
        if (clipIds.length === 0) return notify("info", "Select a clip to paste the keys onto.");
        void bus.run(pasteKeys, { at: playback.getTime(), clipIds }).then(report);
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
  }, [bus, view, playback, timeline, project, scope, rows, root, keyActions]);
}

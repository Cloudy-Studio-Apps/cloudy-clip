import { useMemo } from "react";
import { useKernel, useModule } from "@/core";
import { setProps } from "@/modules/element";
import { seek } from "@/modules/preview";
import { projectRef, type ClipId } from "@/modules/project";
import { timelineRef } from "@/modules/timeline";
import { mergeCues, splitCue } from "../subtitle.cue.commands";
import { subtitleRef } from "../subtitle.ref";
import { report } from "./report";

const wordsOf = (props: Record<string, unknown> | undefined) => String(props?.text ?? "");

/**
 * What the words of a cue-list row do: focusing selects the cue and seeks to it; Enter splits at
 * the caret (with the typed words, one undo step), Shift+Enter is a new line, Backspace at the
 * start merges with the cue right before on the same track, Up at the start and Down at the end
 * go to the row before or after, Esc leaves; the words are written on blur (one `element.setProps`).
 */
export function useCueEditing() {
  const { bus } = useKernel();
  const project = useModule(projectRef).store;
  const timeline = useModule(timelineRef);
  const { view } = useModule(subtitleRef);

  return useMemo(() => {
    const focusRow = (clipId: ClipId, caret: number | "end") =>
      view.setState({ focus: { clipId, caret } });

    const save = async (clipId: ClipId, text: string) => {
      const clip = project.getState().clips[clipId];
      if (!clip || wordsOf(clip.props) === text) return;
      report(await bus.run(setProps, { clipIds: [clipId], patch: { text } }));
    };

    const split = async (clipId: ClipId, at: number, text: string) => {
      const done = report(await bus.run(splitCue, { clipId, at, text }));
      if (done) focusRow(done.clipIds[1], 0);
    };

    const merge = async (clipId: ClipId, text: string) => {
      const state = project.getState();
      const clip = state.clips[clipId];
      if (!clip) return;
      const before = (state.tracks[clip.trackId]?.clipIds ?? [])
        .map((id) => state.clips[id])
        .find((c) => c?.subtitle && Math.abs(c.start + c.duration - clip.start) <= 1);
      if (!before) return;
      const head = wordsOf(before.props);
      const done = report(
        await bus.run(mergeCues, { clipIds: [before.id, clipId], text: `${head} ${text}` }),
      );
      if (done) focusRow(done.clipId, head.length + 1);
    };

    return {
      onFocus(clipId: ClipId) {
        const clip = project.getState().clips[clipId];
        if (!clip) return;
        if (timeline.view.getState().selection.join() !== clipId) timeline.selectClip(clipId);
        view.setState({ tab: "cue" });
        void bus.run(seek, { time: clip.start });
      },
      onBlur(clipId: ClipId, field: HTMLTextAreaElement) {
        void save(clipId, field.value);
      },
      onKeyDown(
        e: React.KeyboardEvent<HTMLTextAreaElement>,
        clipId: ClipId,
        rows: { prev?: ClipId; next?: ClipId },
      ) {
        const field = e.currentTarget;
        const caret = field.selectionStart;
        const collapsed = caret === field.selectionEnd;
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          void split(clipId, caret, field.value);
        } else if (e.key === "Backspace" && collapsed && caret === 0) {
          e.preventDefault();
          void merge(clipId, field.value);
        } else if (e.key === "ArrowUp" && collapsed && caret === 0 && rows.prev) {
          e.preventDefault();
          focusRow(rows.prev, "end");
        } else if (
          e.key === "ArrowDown" &&
          collapsed &&
          caret === field.value.length &&
          rows.next
        ) {
          e.preventDefault();
          focusRow(rows.next, 0);
        } else if (e.key === "Escape") {
          field.blur();
        }
      },
    };
  }, [bus, project, timeline, view]);
}

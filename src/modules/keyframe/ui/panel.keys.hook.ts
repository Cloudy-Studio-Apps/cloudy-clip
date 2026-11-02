import { useEffect, type RefObject } from "react";
import { useKernel, useModule } from "@/core";
import { projectRef, clipEnd, timeOfContent } from "@/modules/project";
import { timelineRef } from "@/modules/timeline";
import { moveKeys } from "../keyframe.edit.commands";
import { keyframeRef } from "../keyframe.ref";
import type { KeyBox, KeyRef } from "../keyframe.types";
import { keysAtTime, keysInBox, parseRef, refId } from "../logic/picking";
import { startBoxSelect } from "./box.gesture";
import { startKeyDrag } from "./key.gesture";
import type { PanelActions } from "./panel.actions.hook";

/** Whether a key press belongs to a text field (the same rule as the app's keybindings). */
function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

/** Toggles refs in a selection: all in, they come out; otherwise they are added. */
function toggled(selection: readonly KeyRef[], refs: readonly KeyRef[]): KeyRef[] {
  const ids = new Set(refs.map(refId));
  const all = refs.every((r) => selection.some((s) => refId(s) === refId(r)));
  return all
    ? selection.filter((s) => !ids.has(refId(s)))
    : [...selection, ...refs.filter((r) => !selection.some((s) => refId(s) === refId(r)))];
}

/**
 * The panel's pointer and keyboard: presses select keys and start drags and rubber bands, a press
 * inside sets `focused` and one outside clears it, and, while focused with keys selected, Delete,
 * Ctrl+C and Ctrl+V act on the keys before the app's shortcuts see them.
 */
export function usePanelKeys(root: RefObject<HTMLElement | null>, actions: PanelActions): void {
  const { bus } = useKernel();
  const { view } = useModule(keyframeRef);
  const project = useModule(projectRef).store;
  const timeline = useModule(timelineRef);

  useEffect(() => {
    const panel = root.current;
    if (!panel) return;

    const drag = (event: PointerEvent, refs: readonly KeyRef[]) => {
      const state = project.getState();
      const keys = refs.flatMap((ref) => {
        const clip = state.clips[ref.clipId];
        const key = clip?.animation?.[ref.path]?.keys.find((k) => k.id === ref.keyId);
        return clip && key
          ? [
              {
                ref,
                moved: {
                  time: timeOfContent(clip, key.t),
                  clipStart: clip.start,
                  clipEnd: clipEnd(clip),
                },
              },
            ]
          : [];
      });
      startKeyDrag({
        event,
        root: panel,
        pxPerSecond: timeline.view.getState().pxPerSecond,
        keys,
        onDrop: (delta) => void bus.run(moveKeys, { keys: refs.slice(), delta }),
      });
    };

    const select = (event: PointerEvent, refs: readonly KeyRef[]) => {
      const additive = event.ctrlKey || event.metaKey || event.shiftKey;
      const current = view.getState().selection;
      if (additive) {
        view.setState({ selection: toggled(current, refs) });
        return;
      }
      const held = refs.every((r) => current.some((s) => refId(s) === refId(r)));
      const next = held ? current : refs.slice();
      if (!held) view.setState({ selection: next });
      drag(event, next);
    };

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || !(e.target instanceof Element)) return;
      view.setState({ focused: true });
      const diamond = e.target.closest<HTMLElement>("[data-key-ref]");
      const summary = e.target.closest<HTMLElement>("[data-key-summary]");
      if (diamond) {
        const ref = parseRef(diamond.dataset.keyRef ?? "");
        if (ref) select(e, [ref]);
      } else if (summary) {
        const [clipId, time] = (summary.dataset.keySummary ?? "").split("|");
        const clip = clipId ? project.getState().clips[clipId] : undefined;
        if (clip && time) select(e, keysAtTime(clip, Number(time)));
      } else if (e.target.closest("[data-key-plane]")) {
        const additive = e.ctrlKey || e.metaKey || e.shiftKey;
        startBoxSelect({
          event: e,
          root: panel,
          onDone: (box) => {
            const boxes: KeyBox[] = [
              ...panel.querySelectorAll<HTMLElement>("[data-key-ref]"),
            ].flatMap((el) => {
              const ref = parseRef(el.dataset.keyRef ?? "");
              const r = el.getBoundingClientRect();
              return ref
                ? [{ ref, box: { left: r.left, top: r.top, right: r.right, bottom: r.bottom } }]
                : [];
            });
            const hit = keysInBox(boxes, box);
            const current = view.getState().selection;
            view.setState({
              selection: additive
                ? [...current, ...hit.filter((h) => !current.some((s) => refId(s) === refId(h)))]
                : hit,
            });
          },
        });
      }
    };

    // A press anywhere else (a track, the preview) hands the shortcuts back to the clips.
    const onAnyDown = (e: PointerEvent) => {
      if (e.target instanceof Node && !panel.contains(e.target)) view.setState({ focused: false });
    };

    const onKey = (e: KeyboardEvent) => {
      const state = view.getState();
      if (!state.focused || state.selection.length === 0 || isTyping(e.target)) return;
      const mod = e.ctrlKey || e.metaKey;
      const act =
        e.key === "Delete" || e.key === "Backspace"
          ? actions.remove
          : mod && e.key.toLowerCase() === "c"
            ? actions.copy
            : mod && e.key.toLowerCase() === "v"
              ? actions.paste
              : null;
      if (!act) return;
      e.preventDefault();
      e.stopPropagation();
      act();
    };

    panel.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerdown", onAnyDown, true);
    window.addEventListener("keydown", onKey, true);
    return () => {
      panel.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerdown", onAnyDown, true);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [root, bus, view, project, timeline, actions]);
}

import { useEffect } from "react";
import { notify, useKernel, useModule } from "@/core";
import { keyframeRef, removeKeys } from "@/modules/keyframe";

/** Whether a key event comes from a field the user is typing in. */
function typing(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

/**
 * The keyboard of the clips' volume lines, drawn nowhere: while a point of a line is selected,
 * Delete (or Backspace) removes the key before the timeline's own Delete sees it (so the clip
 * stays), and a press anywhere else lets go of the selection. This is the one handler for it;
 * while `keyframe`'s panel is open it handles the same selection itself, so this steps aside.
 */
export function ClipLineKeys() {
  const { bus } = useKernel();
  const { view } = useModule(keyframeRef);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { mode, focused, selection } = view.getState();
      if (mode !== "normal" || !focused || selection.length === 0 || typing(e.target)) return;
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      void bus.run(removeKeys, { keys: selection }).then((result) => {
        if (!result.ok) notify("error", result.error.message);
      });
    };
    const onDown = (e: PointerEvent) => {
      const { mode, focused } = view.getState();
      if (mode !== "normal" || !focused) return;
      if (e.target instanceof Element && e.target.closest("[data-clipline-point]")) return;
      view.setState({ focused: false, selection: [] });
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("pointerdown", onDown, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("pointerdown", onDown, true);
    };
  }, [bus, view]);
  return null;
}

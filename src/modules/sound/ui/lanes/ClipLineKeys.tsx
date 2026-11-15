import { useEffect } from "react";
import { notify, useKernel, useModule } from "@/core";
import { keyframeRef, removeKeys } from "@/modules/keyframe";
import { removeLineKeys } from "../../sound.line.commands";
import { soundRef } from "../../sound.ref";

/** Whether a key event comes from a field the user is typing in. */
function typing(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

/**
 * The keyboard of the volume lines, drawn nowhere: while a point of a line is selected, Delete (or
 * Backspace) removes it before the timeline's own Delete sees it (so the clip stays), and a press
 * anywhere else lets go of the selection. A track line's point (`view.linePoint`) goes with
 * `sound.removeLineKeys`; a clip line's key with `keyframe.remove`. This is the one handler for
 * both; while `keyframe`'s panel is open it handles the clip keys itself, so this steps aside for
 * those.
 */
export function ClipLineKeys() {
  const { bus } = useKernel();
  const { view } = useModule(keyframeRef);
  const sound = useModule(soundRef).view;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const point = sound.getState().linePoint;
      if (point && !typing(e.target)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        sound.setState({ linePoint: null });
        void bus
          .run(removeLineKeys, { target: point.trackId, keyIds: [point.keyId] })
          .then((result) => {
            if (!result.ok) notify("error", result.error.message);
          });
        return;
      }
      const { mode, focused, selection } = view.getState();
      if (mode !== "normal" || !focused || selection.length === 0 || typing(e.target)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      void bus.run(removeKeys, { keys: selection }).then((result) => {
        if (!result.ok) notify("error", result.error.message);
      });
    };
    const onDown = (e: PointerEvent) => {
      const onPoint = e.target instanceof Element && e.target.closest("[data-clipline-point]");
      if (!onPoint && sound.getState().linePoint) sound.setState({ linePoint: null });
      const { mode, focused } = view.getState();
      if (mode !== "normal" || !focused) return;
      if (onPoint) return;
      view.setState({ focused: false, selection: [] });
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("pointerdown", onDown, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("pointerdown", onDown, true);
    };
  }, [bus, view, sound]);
  return null;
}

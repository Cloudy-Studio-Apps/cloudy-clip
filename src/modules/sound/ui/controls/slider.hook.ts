import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import type { SliderOptions } from "../../sound.types";
import { startFaderDrag } from "./fader.gesture";

/**
 * A drag along a groove: the handle and the live sound follow the pointer, and the release sends
 * one command when the value changed. A press without movement sends nothing, so a double-click is
 * one step: back to `rest`. No React state (rule 24). `busy()` is true from the press until the
 * command has landed: the handle isn't placed from the document meanwhile.
 */
export function useSliderDrag(options: SliderOptions) {
  const {
    axis,
    trackRef,
    handleRef,
    toPosition,
    fromPosition,
    rest,
    place,
    onInput,
    onCommit,
    read,
  } = options;

  const pending = useRef(0);

  // The live value goes once the command has landed, so the sound doesn't blip back meanwhile.
  const finish = (value: number | null) => {
    pending.current++;
    void (value === null ? Promise.resolve() : onCommit(value)).then(() => {
      pending.current--;
      onInput(null);
      place(read());
    });
  };

  return {
    busy: () => pending.current > 0,
    onPointerDown(e: ReactPointerEvent<HTMLElement>) {
      if (e.button !== 0 || !trackRef.current) return;
      e.stopPropagation();
      pending.current++;
      const from = read();
      startFaderDrag({
        down: e.nativeEvent,
        track: trackRef.current,
        axis,
        start: toPosition(from),
        grabbed: e.target === handleRef.current,
        onMove(position) {
          const value = fromPosition(position);
          place(value);
          onInput(value);
        },
        onEnd(position) {
          pending.current--;
          const value = position === null ? from : fromPosition(position);
          finish(value === from ? null : value);
        },
      });
    },
    onDoubleClick() {
      if (read() !== rest) finish(rest);
    },
  };
}

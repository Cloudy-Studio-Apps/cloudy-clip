import type { PointerEvent as ReactPointerEvent } from "react";
import type { SliderOptions } from "../sound.types";
import { startFaderDrag } from "./fader.gesture";

/**
 * A drag along a groove: the handle and the live sound follow the pointer, the release sends one
 * command when the value changed, and a double-click returns to `rest`. No React state (rule 24).
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

  // The live value goes once the command has landed, so the sound doesn't blip back meanwhile.
  const finish = (value: number | null) =>
    void (value === null ? Promise.resolve() : onCommit(value)).then(() => {
      onInput(null);
      place(read());
    });

  return {
    onPointerDown(e: ReactPointerEvent<HTMLElement>) {
      if (e.button !== 0 || !trackRef.current) return;
      e.stopPropagation();
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
          const value = fromPosition(position);
          finish(value === from ? null : value);
        },
      });
    },
    onDoubleClick() {
      if (read() !== rest) finish(rest);
    },
  };
}

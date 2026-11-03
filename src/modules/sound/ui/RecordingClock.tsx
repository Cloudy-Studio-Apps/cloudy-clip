import { useEffect, useRef } from "react";
import { useModule } from "@/core";
import { formatElapsed } from "../logic/record";
import { soundRef } from "../sound.ref";

/**
 * How long the take has run, `mm:ss`. Read from the recorder each frame and written through the
 * DOM only when the second changes (rule 24); mounted only while a take records.
 */
export function RecordingClock() {
  const { recorder } = useModule(soundRef);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const clock = ref.current;
    if (!clock) return;
    let frame = 0;
    let shown = "";
    const draw = () => {
      const text = formatElapsed(recorder.length());
      if (text !== shown) clock.textContent = shown = text;
      frame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [recorder]);

  return (
    <span ref={ref} className="font-mono tabular-nums">
      00:00
    </span>
  );
}

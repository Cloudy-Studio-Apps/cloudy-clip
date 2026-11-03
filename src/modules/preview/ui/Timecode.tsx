import { useEffect, useRef } from "react";
import { formatTimecode, useModule, type Micros } from "@/core";
import { useOpenComposition } from "@/modules/project";
import { previewRef } from "../preview.ref";

interface TimecodeProps {
  /**
   * Only the time, `mm:ss` with the hundredths `.cc` muted, and no length: for a transport row
   * that shows the length elsewhere.
   */
  compact?: boolean;
}

/** The time, split at the hundredths when `compact` (`mm:ss.cc` → `["mm:ss", ".cc"]`). */
function timeParts(time: Micros, compact: boolean): [string, string] {
  const text = formatTimecode(time);
  const dot = compact ? text.lastIndexOf(".") : -1;
  return dot < 0 ? [text, ""] : [text.slice(0, dot), text.slice(dot)];
}

/**
 * Current time / project length (or, `compact`, the time alone). The current time updates
 * without React renders.
 */
export function Timecode({ compact = false }: TimecodeProps) {
  const { playback } = useModule(previewRef);
  const duration = useOpenComposition()?.duration ?? 0;
  const timeRef = useRef<HTMLSpanElement>(null);
  const centisRef = useRef<HTMLSpanElement>(null);

  useEffect(
    () =>
      playback.onTime((time) => {
        const [whole, centis] = timeParts(time, compact);
        if (timeRef.current) timeRef.current.textContent = whole;
        if (centisRef.current) centisRef.current.textContent = centis;
      }),
    [playback, compact],
  );

  const [whole, centis] = timeParts(playback.getTime(), compact);
  return (
    <span className="font-mono text-[17px] font-bold tabular-nums">
      <span ref={timeRef}>{whole}</span>
      <span className="text-[13px] font-normal text-subtle-foreground">
        {compact ? <span ref={centisRef}>{centis}</span> : ` / ${formatTimecode(duration)}`}
      </span>
    </span>
  );
}

import { useEffect, useRef } from "react";
import { formatTimecode, useModule } from "@/core";
import { useOpenComposition } from "@/modules/project";
import { previewRef } from "../preview.ref";

interface TimecodeProps {
  /**
   * Only the time, `mm:ss` with the hundredths `.cc` muted, and no length: for a transport row
   * that shows the length elsewhere.
   */
  compact?: boolean;
}

/** `mm:ss.cc` → `["mm:ss", ".cc"]`, split at the hundredths. */
function splitCentis(text: string): [string, string] {
  const dot = text.lastIndexOf(".");
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
        const text = formatTimecode(time);
        if (!compact) {
          if (timeRef.current) timeRef.current.textContent = text;
          return;
        }
        const [whole, centis] = splitCentis(text);
        if (timeRef.current) timeRef.current.textContent = whole;
        if (centisRef.current) centisRef.current.textContent = centis;
      }),
    [playback, compact],
  );

  if (compact) {
    const [whole, centis] = splitCentis(formatTimecode(playback.getTime()));
    return (
      <span className="font-mono text-[17px] font-bold tabular-nums">
        <span ref={timeRef}>{whole}</span>
        <span ref={centisRef} className="text-[13px] font-normal text-subtle-foreground">
          {centis}
        </span>
      </span>
    );
  }

  return (
    <span className="font-mono text-[17px] font-bold tabular-nums">
      <span ref={timeRef}>{formatTimecode(playback.getTime())}</span>
      <span className="text-[13px] font-normal text-subtle-foreground">
        {" "}
        / {formatTimecode(duration)}
      </span>
    </span>
  );
}

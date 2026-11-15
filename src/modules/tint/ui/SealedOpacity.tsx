import { useEffect, useRef } from "react";
import { useKernel, useModule } from "@/core";
import { setCorrections } from "../tint.node.commands";
import { tintRef } from "../tint.ref";
import { settle } from "./settle";
import type { GradeSubject } from "./ui.types";

interface SealedOpacityProps {
  subject: GradeSubject;
  /** The corrections inside the card. */
  ids: readonly string[];
  /** Saved opacity of the first one, 0 to 1. */
  opacity: number;
}

/**
 * The opacity of a sealed card: drag sideways to fade every correction inside (one percent per
 * pixel). The picture follows through the live values; the command goes on release (one undo step).
 */
export function SealedOpacity({ subject, ids, opacity }: SealedOpacityProps) {
  const { bus } = useKernel();
  const tint = useModule(tintRef);
  const label = useRef<HTMLSpanElement>(null);
  const drag = useRef<{ x: number; last: number; off(): void } | null>(null);
  const show = (value: number) => {
    if (label.current) label.current.textContent = `${Math.round(value * 100)}%`;
  };
  useEffect(() => show(opacity), [opacity]);
  const finish = (save: boolean) => {
    const at = drag.current;
    drag.current = null;
    if (!at) return;
    at.off();
    tint.live.set(subject.id, null);
    if (!save || at.last === opacity) return show(opacity);
    const patch = { opacity: at.last };
    void settle(bus.run(setCorrections, { target: subject.target, nodeIds: [...ids], patch }));
  };
  return (
    <span
      ref={label}
      title="Opacity of everything inside: drag to change"
      className="cursor-ew-resize touch-none select-none font-mono text-xs text-muted-foreground"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        const escape = (key: KeyboardEvent) => key.key === "Escape" && finish(false);
        window.addEventListener("keydown", escape, true);
        drag.current = {
          x: event.clientX,
          last: opacity,
          off: () => window.removeEventListener("keydown", escape, true),
        };
      }}
      onPointerMove={(event) => {
        const at = drag.current;
        if (!at) return;
        at.last = Math.min(
          1,
          Math.max(0, Math.round((opacity + (event.clientX - at.x) / 100) * 100) / 100),
        );
        show(at.last);
        tint.live.set(subject.id, {
          nodes: Object.fromEntries(ids.map((id) => [id, { opacity: at.last }])),
        });
      }}
      onPointerUp={() => finish(true)}
      onPointerCancel={() => finish(false)}
    >
      {Math.round(opacity * 100)}%
    </span>
  );
}

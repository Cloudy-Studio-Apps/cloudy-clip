import type { Ref } from "react";
import { cn } from "@/ui";
import type { SoonId } from "../../sound.types";
import { soon as soonProps } from "../soon";

interface PanelValueProps {
  label: string;
  /** The value; `—` when there is none. */
  value?: string;
  /** Drawn small after the value: `LUFS`, `dB`… */
  unit?: string;
  /** A `▾` after the value: it is picked from a list. */
  pick?: boolean;
  /** `mark`: changed from its default, in red. `on`: good, in blue pencil. */
  tone?: "mark" | "on";
  /** The value's own text, for a caller that writes it through the DOM each frame (rule 24). */
  valueRef?: Ref<HTMLSpanElement>;
  /** A placeholder: the row says it's coming (`soon`). Leave `value` unset, so it shows `—`. */
  soon?: SoonId;
}

/** A row of a panel card: the label at the left, the value at the right in mono over a rule. */
export function PanelValue({ label, value, unit, pick, tone, valueRef, soon }: PanelValueProps) {
  const placeholder = soon ? soonProps(soon) : null;
  return (
    <div
      {...placeholder}
      className={cn(
        "flex min-h-[25px] items-center justify-between gap-2 text-muted-foreground",
        placeholder?.className,
      )}
    >
      <span>{label}</span>
      <span
        className={cn(
          "min-w-[58px] whitespace-nowrap border-b py-px text-right font-mono text-base font-bold",
          tone === "mark" ? "border-mark text-mark" : "border-border-strong",
          tone === "on" ? "text-on" : tone !== "mark" && "text-foreground",
        )}
      >
        <span ref={valueRef}>{value ?? "—"}</span>
        {unit && <span className="ml-0.5 text-xs font-normal text-subtle-foreground">{unit}</span>}
        {pick && <span className="font-normal text-subtle-foreground"> ▾</span>}
      </span>
    </div>
  );
}

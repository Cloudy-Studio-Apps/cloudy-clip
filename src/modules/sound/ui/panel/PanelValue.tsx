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
  /** A placeholder: its value says it's coming (`soon`). Leave `value` unset, so it shows `—`. */
  soon?: SoonId;
}

/**
 * A row of a panel card: the label at the left, the value at the right in mono over a rule. A
 * placeholder's value is a button that does nothing (`soon`): focusable, announced as dimmed, and
 * its tooltip says what's coming.
 */
export function PanelValue({ label, value, unit, pick, tone, valueRef, soon }: PanelValueProps) {
  const valueClass = cn(
    "min-w-[58px] whitespace-nowrap border-b py-px text-right font-mono text-base font-bold",
    tone === "mark" ? "border-mark text-mark" : "border-border-strong",
    tone === "on" ? "text-on" : tone !== "mark" && "text-foreground",
  );
  const content = (
    <>
      <span ref={valueRef}>{value ?? "—"}</span>
      {unit && <span className="ml-0.5 text-xs font-normal text-subtle-foreground">{unit}</span>}
      {pick && <span className="font-normal text-subtle-foreground"> ▾</span>}
    </>
  );
  return (
    <div className="flex min-h-[25px] items-center justify-between gap-2 text-muted-foreground">
      <span>{label}</span>
      {soon ? (
        <button
          type="button"
          aria-label={label}
          {...soonProps(soon)}
          className={cn(valueClass, "cursor-default")}
        >
          {content}
        </button>
      ) : (
        <span className={valueClass}>{content}</span>
      )}
    </div>
  );
}

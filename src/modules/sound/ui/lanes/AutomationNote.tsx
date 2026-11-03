import { cn } from "@/ui";
import { soon } from "../soon";

/**
 * "Automation —" at the right of the timeline's tools: the automation mode (Read, Touch, Latch)
 * comes in stage 3; until then it names none.
 */
export function AutomationNote() {
  const props = soon("lanes.automation");
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "shrink-0 whitespace-nowrap px-1 font-mono text-sm text-muted-foreground",
        props.className,
      )}
    >
      Automation —
    </button>
  );
}

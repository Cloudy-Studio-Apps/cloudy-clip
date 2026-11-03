import { Check } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/ui";

interface CheckRowProps extends Omit<ComponentProps<"button">, "children" | "role"> {
  label: string;
  checked: boolean;
}

/**
 * A ticked or unticked line of a panel card: a 13 px box, filled `--on` with a check when ticked,
 * outlined when not, then the label. Extra props go on the button after its own, so a placeholder
 * spreads `soon(…)` onto it.
 */
export function CheckRow({ label, checked, className, ...props }: CheckRowProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      {...props}
      className={cn(
        "flex min-h-6 w-full items-center gap-[7px] text-left text-muted-foreground",
        className,
      )}
    >
      <span
        className={cn(
          "grid size-[13px] shrink-0 place-items-center rounded-xs",
          checked ? "bg-on text-primary-foreground" : "border border-border-strong",
        )}
      >
        {checked && <Check className="size-[11px]" strokeWidth={4} />}
      </span>
      {label}
    </button>
  );
}

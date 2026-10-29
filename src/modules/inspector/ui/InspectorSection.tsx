import { ChevronRight } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/ui";

interface InspectorSectionProps {
  title: string;
  /** Controls at the right of the header (a group's switch); clicking them doesn't collapse. */
  actions?: ReactNode;
  children: ReactNode;
}

/** A collapsible group of fields, like Premiere's Effect Controls. */
export function InspectorSection({ title, actions, children }: InspectorSectionProps) {
  const [open, setOpen] = useState(true);
  const hasBody = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <section className="border-b border-border">
      <div className="flex h-[34px] items-center pr-3">
        <button
          type="button"
          aria-expanded={open}
          className="flex h-full min-w-0 flex-1 cursor-pointer items-center gap-1 px-2 text-left text-sm font-semibold"
          onClick={() => setOpen(!open)}
        >
          <ChevronRight
            aria-hidden
            strokeWidth={2.25}
            className={cn(
              "size-3 text-subtle-foreground transition-[rotate] duration-150 ease-out",
              open && "rotate-90",
            )}
          />
          <span className="truncate">{title}</span>
        </button>
        {actions}
      </div>
      {open && hasBody && <div className="flex flex-col gap-2 px-3 pb-3 pt-0.5">{children}</div>}
    </section>
  );
}

import { ChevronRight } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/ui";

interface InspectorSectionProps {
  title: string;
  children: ReactNode;
}

/** A collapsible group of fields, like Premiere's Effect Controls. */
export function InspectorSection({ title, children }: InspectorSectionProps) {
  const [open, setOpen] = useState(true);
  return (
    <section className="border-b border-border">
      <button
        type="button"
        aria-expanded={open}
        className="flex h-[34px] w-full cursor-pointer items-center gap-1 px-2 text-left text-sm font-semibold"
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
        {title}
      </button>
      {open && <div className="flex flex-col gap-2 px-3 pb-3 pt-0.5">{children}</div>}
    </section>
  );
}

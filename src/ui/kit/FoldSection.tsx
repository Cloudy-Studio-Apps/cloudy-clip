import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../lib/cn";

interface FoldSectionProps {
  title: string;
  open: boolean;
  onToggle(): void;
  /** Left of the title: a group's switch. The slot stays, so titles line up. */
  leading?: ReactNode;
  /** Right of the band; clicking them doesn't fold. */
  actions?: ReactNode;
  children?: ReactNode;
}

/** A pencilled title with a chevron that folds the fields under it. */
export function FoldSection({
  title,
  open,
  onToggle,
  leading,
  actions,
  children,
}: FoldSectionProps) {
  const hasBody = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <section className="border-b border-dashed border-border-strong">
      <div className="flex h-[34px] items-center gap-1.5 px-3">
        {leading !== undefined && (
          <span className="grid shrink-0 place-items-center">{leading}</span>
        )}
        <button
          type="button"
          aria-expanded={open}
          className="flex h-full min-w-0 flex-1 cursor-pointer items-center gap-1.5 text-left font-hand text-[13.5px] font-bold transition-colors hover:text-primary"
          onClick={onToggle}
        >
          <ChevronDown
            aria-hidden
            className={cn(
              "-ml-0.5 size-3.5 shrink-0 transition-transform duration-150 ease-out",
              !open && "-rotate-90",
            )}
          />
          <span className="truncate">{title}</span>
        </button>
        {actions}
      </div>
      {open && hasBody && <div className="flex flex-col gap-1.5 px-3 pb-3 pt-0.5">{children}</div>}
    </section>
  );
}

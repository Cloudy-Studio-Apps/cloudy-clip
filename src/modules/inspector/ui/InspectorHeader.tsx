import type { ReactNode } from "react";
import { cn } from "@/ui";

interface InspectorHeaderProps {
  /** The square badge on the left: the seal for the project, the kind icon for clips. */
  badge: ReactNode;
  /** Badge fill, e.g. the clip's track color. */
  badgeClassName?: string;
  title: string;
  subtitle: string;
}

/** What the inspector is showing: a badge, a name and a short description. */
export function InspectorHeader({ badge, badgeClassName, title, subtitle }: InspectorHeaderProps) {
  return (
    <header className="flex shrink-0 items-center gap-2.5 border-b border-border px-3 py-2.5">
      <span
        className={cn(
          "grid size-[30px] shrink-0 place-items-center bg-muted text-muted-foreground [&_svg]:size-[15px]",
          badgeClassName,
        )}
      >
        {badge}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <b className="truncate font-semibold">{title}</b>
        <span className="truncate text-xs text-muted-foreground">{subtitle}</span>
      </div>
    </header>
  );
}

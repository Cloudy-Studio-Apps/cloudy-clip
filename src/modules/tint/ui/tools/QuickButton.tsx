import type { ComponentType } from "react";

/** A square one-click button with an icon; its label is the tooltip. */
export function QuickButton({
  icon: Icon,
  label,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className="grid h-10 w-[46px] cursor-pointer place-items-center rounded-sm text-muted-foreground shadow-[inset_0_0_0_1px_var(--border-strong)] hover:bg-hover hover:text-foreground"
    >
      <Icon className="size-[18px]" />
    </button>
  );
}

/** The name column of a row: right-aligned, so names sit against their values. */
export function FieldLabel({ children }: { children: string }) {
  return (
    <span className="w-[68px] shrink-0 truncate text-right text-xs text-muted-foreground">
      {children}
    </span>
  );
}

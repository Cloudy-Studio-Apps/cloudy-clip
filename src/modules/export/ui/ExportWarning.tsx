import { TriangleAlert } from "lucide-react";
import { cn } from "@/ui";

interface ExportWarningProps {
  message: string;
  /** Whether it stops the export. */
  blocking: boolean;
}

/** One line on what's wrong, or worth knowing. */
export function ExportWarning({ message, blocking }: ExportWarningProps) {
  return (
    <p
      role="status"
      className={cn(
        "flex shrink-0 items-center gap-2 rounded-[3px] px-2.5 py-1.5 text-sm",
        blocking
          ? "bg-destructive-soft text-destructive-soft-foreground"
          : "bg-accent-soft text-accent-soft-foreground",
      )}
    >
      <TriangleAlert className="size-3.5 shrink-0" />
      {message}
    </p>
  );
}

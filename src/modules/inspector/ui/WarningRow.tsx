import { TriangleAlert } from "lucide-react";

/** Shown in place of a control or section that can't be drawn: what is missing and why. */
export function WarningRow({ title, detail }: { title: string; detail: string }) {
  return (
    <div
      role="note"
      className="flex gap-2 rounded-sm border border-destructive/40 bg-destructive-soft p-2 text-xs text-destructive-soft-foreground"
    >
      <TriangleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
      <div className="flex min-w-0 flex-col gap-0.5">
        <b className="font-semibold">{title}</b>
        <span className="opacity-90">{detail}</span>
      </div>
    </div>
  );
}

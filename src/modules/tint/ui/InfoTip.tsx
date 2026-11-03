import { Info } from "lucide-react";

/** A small ⓘ that explains a section on hover, so the panel shows only controls. */
export function InfoTip({ text }: { text: string }) {
  return (
    <span
      title={text}
      aria-label={text}
      className="inline-grid size-4 cursor-help place-items-center text-subtle-foreground hover:text-foreground"
    >
      <Info className="size-3.5" />
    </span>
  );
}

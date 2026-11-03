import { cn } from "@/ui";
import { DEMO_FRAME } from "../demo/demo.images";
import type { DemoLook } from "../demo/demo.types";

/** A look or still: the current frame through it, its name, and where it came from. */
export function LookCard({ look, chosen }: { look: DemoLook; chosen: boolean }) {
  return (
    <button
      type="button"
      title={`Apply ${look.name}`}
      className="flex cursor-pointer flex-col gap-1 text-left font-hand text-sm font-bold text-muted-foreground"
    >
      <img
        src={DEMO_FRAME}
        alt=""
        draggable={false}
        className={cn(
          "aspect-video w-full rounded-sm object-cover",
          chosen ? "shadow-[0_0_0_1.5px_var(--mark)]" : "shadow-[0_0_0_1px_var(--border)]",
        )}
        style={{ filter: look.look }}
      />
      {look.name}
      <span className="font-mono text-2xs font-normal text-subtle-foreground">{look.note}</span>
    </button>
  );
}

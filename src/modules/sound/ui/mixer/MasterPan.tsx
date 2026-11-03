import { cn } from "@/ui";
import { soon } from "../soon";

/**
 * The master's pan, drawn as a strip's (`PanSlider`) with its thumb at the centre. Coming soon
 * (`master.pan`, stage 4): it doesn't move and changes nothing; the mix is centred.
 */
export function MasterPan() {
  const props = soon("master.pan");
  return (
    <button
      type="button"
      aria-label="Master pan"
      {...props}
      className={cn("relative block h-3.5 w-full shrink-0", props.className)}
    >
      <span className="absolute inset-x-0 top-1.5 h-0.5 bg-border-strong" />
      <span className="absolute left-1/2 top-[3px] h-2 w-px bg-subtle-foreground" />
      <span className="absolute left-1/2 top-px z-10 -ml-1.5 size-3 rounded-full bg-foreground" />
    </button>
  );
}

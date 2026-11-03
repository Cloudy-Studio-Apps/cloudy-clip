import { Button } from "@/ui";
import { DEMO_LOOKS } from "../demo/demo.clips";
import { LookCard } from "./LookCard";

/** Looks: built-in looks and grabbed stills, applied with a click. */
export function LooksTab() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid min-h-0 flex-1 grid-cols-[repeat(auto-fill,minmax(96px,1fr))] content-start gap-2.5 overflow-auto p-3">
        {DEMO_LOOKS.map((look, i) => (
          <LookCard key={look.id} look={look} chosen={i === 0} />
        ))}
      </div>
      <div className="flex shrink-0 gap-2 border-t border-border px-3 py-2.5">
        <Button
          size="sm"
          variant="primary"
          title="Grab still: save this frame and its grade as a look"
        >
          Grab still
        </Button>
        <Button size="sm" title="Apply the chosen look to every selected clip">
          Apply to selected
        </Button>
      </div>
    </div>
  );
}

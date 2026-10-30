import { useModule } from "@/core";
import { useOpenComposition } from "@/modules/project";
import { Button } from "@/ui";
import { compositionRef } from "../composition.ref";

/** What the timeline says with nothing open: the two ways to begin. */
export function EmptyStart() {
  const api = useModule(compositionRef);
  if (useOpenComposition()) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-16 flex flex-col items-center gap-2.5 text-sm text-subtle-foreground">
      <p>Drag something here, or start with a new composition.</p>
      <div className="pointer-events-auto">
        <Button variant="primary" size="sm" onClick={api.openNew}>
          New Composition
        </Button>
      </div>
    </div>
  );
}

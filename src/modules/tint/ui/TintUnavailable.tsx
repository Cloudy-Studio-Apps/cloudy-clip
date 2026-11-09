import { EmptyState } from "@/ui";

/** What the Tint page shows when the GPU can't draw grades: nothing to grade with. */
export function TintUnavailable() {
  return (
    <div className="flex h-full bg-background p-2">
      <EmptyState title="Grading needs a graphics feature this system doesn't have.">
        The Tint page draws colors on the graphics card (WebGL 2). Everything else in Cloudy Clip
        still works.
      </EmptyState>
    </div>
  );
}

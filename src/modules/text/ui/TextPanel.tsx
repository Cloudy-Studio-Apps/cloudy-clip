import { Plus } from "lucide-react";
import { useKernel } from "@/core";
import { addElement, CreateTiles } from "@/modules/timeline";
import { Button } from "@/ui";

/**
 * The Text tab: "Add text" puts a text at the playhead; each tile does the same with its look on
 * click, or lands where it is dropped on the timeline.
 */
export function TextPanel() {
  const { bus } = useKernel();
  return (
    <section className="flex h-full flex-col gap-2.5 overflow-y-auto overflow-x-hidden p-2.5">
      <div className="flex items-center justify-between gap-1.5">
        <h2 className="text-xs font-semibold uppercase tracking-[0.04em] text-subtle-foreground">
          Text
        </h2>
        <Button
          variant="primary"
          size="sm"
          title="Add text at the playhead"
          onClick={() => void bus.run(addElement, { kind: "text" })}
        >
          <Plus />
          Add text
        </Button>
      </div>
      <CreateTiles panel="text" />
      <p className="text-2xs text-muted-foreground">
        Click to add at the playhead, or drag onto the timeline. Move it on the video like any clip.
      </p>
    </section>
  );
}

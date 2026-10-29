import { CreateTiles } from "@/modules/timeline";

/**
 * The Text tab: each tile adds a text with its look at the playhead on click, or where it is
 * dropped on the timeline.
 */
export function TextPanel() {
  return (
    <section className="flex h-full flex-col gap-2.5 overflow-y-auto overflow-x-hidden p-2.5">
      <h2 className="text-xs font-semibold uppercase tracking-[0.04em] text-subtle-foreground">
        Text
      </h2>
      <CreateTiles panel="text" />
      <p className="text-2xs text-muted-foreground">
        Click to add at the playhead, or drag onto the timeline. Move it on the video like any clip.
      </p>
    </section>
  );
}

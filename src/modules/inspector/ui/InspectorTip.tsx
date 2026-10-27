import { Kbd, SealMark } from "@/ui";

/** A friendly hint from the seal at the bottom of the project view. */
export function InspectorTip() {
  return (
    <div className="m-3 flex gap-2.5 bg-primary-soft p-2.5 text-sm text-primary-soft-foreground">
      <SealMark className="size-[34px] shrink-0" />
      <p className="m-0">
        <b>Tip</b> Select a clip to see it here. Press <Kbd>S</Kbd> to split at the playhead.
      </p>
    </div>
  );
}

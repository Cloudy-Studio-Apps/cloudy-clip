import { Upload } from "lucide-react";

/** A quiet reminder at the bottom of the panel that files can be dropped anywhere. */
export function DropHint() {
  return (
    <div className="mt-auto flex items-center justify-center gap-1.5 border border-dashed border-border p-2 text-xs text-subtle-foreground">
      <Upload className="size-[13px]" />
      Drag files anywhere to import
    </div>
  );
}

/** Covers the panel while files from the OS are dragged over the window. */
export function DropOverlay() {
  return (
    <div className="pointer-events-none absolute inset-2 flex items-center justify-center border-2 border-dashed border-primary bg-primary-soft/80 text-base font-medium text-primary-soft-foreground">
      Drop to import
    </div>
  );
}

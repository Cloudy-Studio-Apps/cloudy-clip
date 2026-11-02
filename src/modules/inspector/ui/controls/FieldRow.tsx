import type { ReactNode } from "react";
import { useFieldInline } from "./field.context";
import { FieldLabel } from "./FieldLabel";

/**
 * A field's name on the left and its control filling the rest of the row. In a labelled row it
 * draws only the control. The row's end (reset, …) is the panel's: controls don't draw it.
 */
export function FieldRow({ label, children }: { label: string; children: ReactNode }) {
  const inline = useFieldInline();
  return (
    <div className="flex min-w-0 flex-1 items-center gap-1.5">
      {!inline && <FieldLabel>{label}</FieldLabel>}
      <div className="flex min-w-0 flex-1 items-center">{children}</div>
    </div>
  );
}

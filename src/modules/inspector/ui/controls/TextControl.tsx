import type { FieldControlProps } from "../../inspector.types";
import { pathPatch } from "../../logic/paths";
import { FieldRow } from "./FieldRow";

/** One line of words; commits on Enter or blur. */
export function TextControl({ path, value, label, disabled, live }: FieldControlProps) {
  const text = typeof value === "string" ? value : "";
  return (
    <FieldRow label={label}>
      <input
        key={text}
        aria-label={label}
        defaultValue={text}
        disabled={disabled}
        onBlur={(event) => live.commit(pathPatch(path, event.target.value))}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        className="h-7 w-full min-w-0 rounded-sm border border-border bg-surface-sunken px-2 text-xs text-foreground outline-none focus:border-ring disabled:opacity-50"
      />
    </FieldRow>
  );
}

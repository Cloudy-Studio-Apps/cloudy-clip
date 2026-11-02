import { cn } from "@/ui";

interface MetadataFieldProps {
  label: string;
  value: string;
  /** Fires on blur, when the text changed. Without it the field is read-only. */
  onCommit?(value: string): void;
  /** Several lines. */
  long?: boolean;
}

const FIELD =
  "w-full min-w-0 bg-transparent px-1 text-[13px] text-foreground outline-none focus:border-ring";

/** A label and a text that commits when you leave it. */
export function MetadataField({ label, value, onCommit, long }: MetadataFieldProps) {
  const commit = (next: string) => {
    if (next !== value) onCommit?.(next);
  };
  return (
    <label
      className={cn(
        "grid min-h-[30px] grid-cols-[74px_minmax(0,1fr)] gap-1.5 text-muted-foreground",
        long ? "items-start pt-1.5" : "items-center",
      )}
    >
      {label}
      {long ? (
        <textarea
          key={value}
          aria-label={label}
          defaultValue={value}
          onBlur={(event) => commit(event.target.value)}
          className={cn(FIELD, "h-[58px] resize-y border border-border-strong py-0.5")}
        />
      ) : (
        <input
          key={value}
          aria-label={label}
          defaultValue={value}
          readOnly={!onCommit}
          spellCheck={false}
          onBlur={(event) => commit(event.target.value)}
          className={cn(
            FIELD,
            "h-[26px] border-b border-border-strong",
            !onCommit && "border-dashed font-mono text-subtle-foreground",
          )}
        />
      )}
    </label>
  );
}

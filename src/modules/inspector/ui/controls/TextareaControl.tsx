import type { FieldControlProps } from "../../inspector.types";
import { pathPatch } from "../../logic/paths";

/**
 * Several lines of words: typing shows live, blur or Ctrl/Cmd+Enter commits once. Blank words go
 * back to the saved ones.
 */
export function TextareaControl({ clip, path, value, label, disabled, live }: FieldControlProps) {
  const text = typeof value === "string" ? value : "";
  return (
    <textarea
      // A new key puts in the words after an undo or an agent's edit.
      key={`${clip.id}:${text}`}
      aria-label={label}
      rows={3}
      defaultValue={text}
      disabled={disabled}
      onChange={(event) => live.input(pathPatch(path, event.target.value))}
      onBlur={(event) => {
        const typed = event.target.value;
        if (typed.trim() === "") {
          event.target.value = text;
          live.commit(pathPatch(path, text));
          return;
        }
        live.commit(pathPatch(path, typed));
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) event.currentTarget.blur();
      }}
      className="w-full resize-y rounded-sm border border-border bg-surface-sunken p-2 text-xs text-foreground outline-none focus:border-ring disabled:opacity-50"
    />
  );
}

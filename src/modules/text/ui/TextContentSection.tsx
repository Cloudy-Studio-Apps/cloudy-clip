import { useRef } from "react";
import { useKernel } from "@/core";
import { isTextClip, type Clip } from "@/modules/project";
import { Button } from "@/ui";
import { applyTextPreset } from "../text.commands";
import type { TextPresetId } from "../text.types";
import { useTextLive } from "./text.live.hook";

const PRESETS: { id: TextPresetId; label: string }[] = [
  { id: "title", label: "Title" },
  { id: "highlight", label: "Highlight" },
  { id: "outline", label: "Outline" },
  { id: "pop", label: "Pop!" },
  { id: "lower-third", label: "Lower third" },
];

/** The words (committed on blur or Ctrl/Cmd+Enter) and the preset row. */
export function TextContentSection({ clip }: { clip: Clip }) {
  const { bus } = useKernel();
  const live = useTextLive(clip);
  const field = useRef<HTMLTextAreaElement>(null);
  if (!isTextClip(clip)) return null;

  const commit = async () => {
    const box = field.current;
    if (!box) return;
    // An empty or refused text goes back to the saved words.
    if (!(await live.commitText(box.value))) box.value = clip.text;
  };

  return (
    <>
      <textarea
        // A new key puts in the words after an undo or an agent's edit.
        key={`${clip.id}:${clip.text}`}
        ref={field}
        aria-label="Words"
        rows={3}
        defaultValue={clip.text}
        onChange={(event) => live.inputText(event.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) event.currentTarget.blur();
        }}
        className="w-full resize-y rounded-sm border border-border bg-surface-sunken p-2 text-xs text-foreground outline-none focus:border-ring"
      />
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((preset) => (
          <Button
            key={preset.id}
            size="sm"
            onClick={() => void bus.run(applyTextPreset, { clipId: clip.id, preset: preset.id })}
          >
            {preset.label}
          </Button>
        ))}
      </div>
    </>
  );
}

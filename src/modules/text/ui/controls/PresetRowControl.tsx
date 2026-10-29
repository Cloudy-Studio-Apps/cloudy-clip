import type { CommandControlProps } from "@/modules/inspector";
import { Button } from "@/ui";
import type { TextPresetId } from "../../text.types";

const PRESETS: { id: TextPresetId; label: string }[] = [
  { id: "title", label: "Title" },
  { id: "highlight", label: "Highlight" },
  { id: "outline", label: "Outline" },
  { id: "pop", label: "Pop!" },
  { id: "lower-third", label: "Lower third" },
];

/** The `preset-row` command control: one button per look, running `text.applyPreset`. */
export function PresetRowControl({ run }: CommandControlProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {PRESETS.map((preset) => (
        <Button key={preset.id} size="sm" onClick={() => run({ preset: preset.id })}>
          {preset.label}
        </Button>
      ))}
    </div>
  );
}

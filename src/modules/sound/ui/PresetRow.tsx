import { Trash2 } from "lucide-react";
import { useKernel } from "@/core";
import { IconButton } from "@/ui";
import { EFFECT_NAMES } from "../logic/effects";
import { removePreset, renamePreset } from "../sound.presets.commands";
import type { SoundPreset } from "../sound.types";

/** One of the user's presets in Settings: its name (edited in place), its effects, and Remove. */
export function PresetRow({ preset }: { preset: SoundPreset }) {
  const { bus } = useKernel();
  const rename = (input: HTMLInputElement) => {
    const name = input.value.trim();
    if (name === preset.name) return;
    if (name === "") {
      input.value = preset.name;
      return;
    }
    void bus.run(renamePreset, { presetId: preset.id, name });
  };
  return (
    <li className="flex items-center gap-2 border-b border-dashed border-border-strong py-1.5">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <input
          key={preset.name}
          defaultValue={preset.name}
          maxLength={60}
          aria-label="Preset name"
          className="min-w-0 border-b border-transparent bg-transparent text-base outline-none hover:border-border-strong focus:border-ring"
          onBlur={(event) => rename(event.currentTarget)}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key === "Escape") {
              event.currentTarget.value = preset.name;
              event.currentTarget.blur();
            }
          }}
        />
        <span className="truncate text-xs text-subtle-foreground">
          {preset.effects.map((effect) => EFFECT_NAMES[effect.kind].name).join(", ")}
        </span>
      </div>
      <IconButton
        label={`Remove ${preset.name}`}
        onClick={() => void bus.run(removePreset, { presetId: preset.id })}
      >
        <Trash2 />
      </IconButton>
    </li>
  );
}

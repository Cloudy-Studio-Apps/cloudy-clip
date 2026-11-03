import { useState } from "react";
import { useKernel } from "@/core";
import type { CompositionId } from "@/modules/project";
import { Button } from "@/ui";
import { chainWhere } from "../logic/effects";
import { savePreset } from "../sound.presets.commands";
import type { MixTarget } from "../sound.types";

interface SavePresetFormProps {
  target: MixTarget;
  compositionId: CompositionId | undefined;
  /** After the preset is kept. */
  onSaved(): void;
}

/** A name for the chain, kept as one of the user's presets with `sound.savePreset`. */
export function SavePresetForm({ target, compositionId, onSaved }: SavePresetFormProps) {
  const { bus } = useKernel();
  const [name, setName] = useState("");
  const save = async () => {
    const result = await bus.run(savePreset, { ...chainWhere(target, compositionId), name });
    if (result.ok) onSaved();
  };
  return (
    <form
      className="flex w-56 flex-col gap-2 p-1"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <input
        autoFocus
        value={name}
        maxLength={60}
        placeholder="Preset name"
        aria-label="Preset name"
        className="rounded-sm border border-border bg-surface-sunken px-2 py-1 text-sm outline-none focus:border-ring"
        onChange={(event) => setName(event.target.value)}
      />
      <span className="text-xs text-subtle-foreground">
        Kept on this computer, for any project. Ducking keeps its settings, not its tracks.
      </span>
      <Button type="submit" size="sm" variant="primary" disabled={name.trim() === ""}>
        Save
      </Button>
    </form>
  );
}

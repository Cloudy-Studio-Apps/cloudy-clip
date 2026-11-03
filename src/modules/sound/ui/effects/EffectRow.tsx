import { SoundRow } from "@/modules/audio";
import type { SoundEffect } from "@/modules/project";
import type { EffectEdit } from "../../sound.types";

interface EffectRowProps {
  label: string;
  value: number;
  /** The kind's default: the reset arrow returns to it, and away from it the value is in `--mark`. */
  rest: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  scale?: "linear" | "log";
  disabled: boolean;
  edit: EffectEdit;
  /** The effect with this value, and the `sound.setEffect` patch that sets it. */
  write(value: number): { effect: SoundEffect; patch: Record<string, unknown> };
  /** Each drag step, after the preview has it (a graph redrawing). */
  onLive?(effect: SoundEffect): void;
}

/** One value of an effect, as the Audio tab draws a clip's: plays live while dragged, one command on release. */
export function EffectRow({ rest, edit, write, onLive, ...slider }: EffectRowProps) {
  const commit = (value: number) => {
    const { effect, patch } = write(value);
    void edit.commit(effect.id, patch);
  };
  return (
    <SoundRow
      {...slider}
      rest={rest}
      onInput={(value) => {
        const { effect } = write(value);
        edit.live(effect);
        onLive?.(effect);
      }}
      onCommit={commit}
      onReset={() => commit(rest)}
    />
  );
}

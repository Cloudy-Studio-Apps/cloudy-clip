import { RotateCcw } from "lucide-react";
import { IconButton, SliderField } from "@/ui";

interface SoundRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  /** The value it resets to. */
  rest: number;
  onInput(value: number): void;
  onCommit(value: number): void;
  onReset(): void;
  disabled?: boolean;
}

/** One value of a clip's sound: a slider with a reset arrow. Changed values show in red pencil. */
export function SoundRow({ rest, onReset, ...slider }: SoundRowProps) {
  const changed = slider.value !== rest;
  return (
    <div className="flex min-w-0 items-center gap-1">
      <div
        data-changed={changed ? "" : undefined}
        className="min-w-0 flex-1 data-[changed]:[&_input]:text-mark data-[changed]:[&_label]:border-mark"
      >
        <SliderField {...slider} />
      </div>
      <IconButton
        label={`Reset ${slider.label.toLowerCase()}`}
        disabled={!changed}
        className="!size-[18px] [&_svg]:!size-3"
        onClick={onReset}
      >
        <RotateCcw />
      </IconButton>
    </div>
  );
}

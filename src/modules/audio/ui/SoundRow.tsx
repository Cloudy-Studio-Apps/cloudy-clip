import { RotateCcw } from "lucide-react";
import { KeyAction } from "@/modules/keyframe";
import type { PanelSubject } from "@/modules/inspector";
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
  /** `log` spaces the line by ratios (times in ms). */
  scale?: "linear" | "log";
  /** Makes the value keyable: the clip and the path of its keys. */
  keys?: { clip: PanelSubject; path: string; animated: boolean };
}

/** One value of a clip's sound: a slider with a reset arrow. Changed values show in red pencil. */
export function SoundRow({ rest, onReset, keys, ...slider }: SoundRowProps) {
  const changed = slider.value !== rest || keys?.animated === true;
  return (
    <div data-field-row className="group flex min-w-0 items-center gap-1">
      <div
        data-changed={changed && !keys?.animated ? "" : undefined}
        className="min-w-0 flex-1 data-[changed]:[&_input]:text-mark data-[changed]:[&_label]:border-mark group-data-[key-state=animated]:[&_input]:text-on group-data-[key-state=on-key]:[&_input]:text-mark"
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
      {keys && <KeyAction clip={keys.clip} paths={[keys.path]} disabled={slider.disabled} />}
    </div>
  );
}

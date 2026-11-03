import { SliderField } from "@/ui";
import type { DemoField } from "../demo/demo.types";

const nothing = () => {};

/** Slider rows of demo values. Moving them changes nothing yet. */
export function DemoSliders({ fields }: { fields: readonly DemoField[] }) {
  return (
    <div className="flex flex-col gap-1">
      {fields.map((field) => (
        <SliderField
          key={field.label}
          label={field.label}
          value={field.value}
          min={field.min}
          max={field.max}
          step={field.step}
          onInput={nothing}
          onCommit={nothing}
        />
      ))}
    </div>
  );
}

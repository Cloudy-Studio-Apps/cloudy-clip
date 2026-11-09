import { DEFAULT_CORRECTION } from "@/modules/project";
import { ColorWheel } from "./ColorWheel";
import { GradeSlider } from "./GradeSlider";
import type { WheelsBodyProps } from "./tools.types";
import { wheelEdit } from "./wheel.edit";

const WHEELS = [
  ["shadow", "Shadow"],
  ["midtone", "Midtone"],
  ["highlight", "Highlight"],
] as const;

const RANGES = [
  ["lowRange", "Low range"],
  ["highRange", "High range"],
] as const;

/** The log wheels (shadow, midtone, highlight) and where their ranges meet. */
export function LogWheels({ values, edit }: WheelsBodyProps) {
  const log = values.log;
  const neutral = DEFAULT_CORRECTION.log;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-[repeat(3,128px)] gap-[22px]">
        {WHEELS.map(([key, label]) => (
          <ColorWheel
            key={key}
            label={label}
            wheel={log[key]}
            size={112}
            edit={
              edit.enabled
                ? wheelEdit(edit, log[key], neutral[key], (wheel) => ({
                    values: { log: { ...log, [key]: wheel } },
                  }))
                : undefined
            }
          />
        ))}
      </div>
      <div className="flex max-w-[428px] flex-col gap-1">
        {RANGES.map(([key, label]) => (
          <GradeSlider
            key={key}
            path={`log.${key}`}
            label={label}
            step={0.001}
            value={log[key]}
            resetTo={neutral[key]}
            edit={edit}
            patch={(value) => ({ values: { log: { ...log, [key]: value } } })}
          />
        ))}
      </div>
    </div>
  );
}

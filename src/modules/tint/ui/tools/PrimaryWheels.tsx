import { DEFAULT_CORRECTION } from "@/modules/project";
import { ColorWheel } from "./ColorWheel";
import type { WheelsBodyProps } from "./tools.types";
import { wheelEdit } from "./wheel.edit";

/** The primary wheels, in order. */
export const PRIMARY_WHEELS = [
  ["lift", "Lift"],
  ["gamma", "Gamma"],
  ["gain", "Gain"],
  ["offset", "Offset"],
] as const;

/** The primary wheels: lift, gamma, gain and offset. */
export function PrimaryWheels({ values, edit }: WheelsBodyProps) {
  return (
    <div className="grid grid-cols-[repeat(4,128px)] gap-[22px]">
      {PRIMARY_WHEELS.map(([key, label]) => (
        <ColorWheel
          key={key}
          label={label}
          wheel={values[key]}
          size={112}
          edit={
            edit.enabled
              ? wheelEdit(edit, values[key], DEFAULT_CORRECTION[key], (wheel) => ({
                  values: { [key]: wheel },
                }))
              : undefined
          }
        />
      ))}
    </div>
  );
}

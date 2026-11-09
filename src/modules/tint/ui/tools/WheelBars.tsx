import { DEFAULT_CORRECTION } from "@/modules/project";
import { PRIMARY_WHEELS } from "./PrimaryWheels";
import type { WheelsBodyProps } from "./tools.types";
import { WheelBarGroup } from "./WheelBarGroup";
import { wheelEdit } from "./wheel.edit";

/** The primary wheels as bars: master, red, green and blue of each, the same values as the wheels. */
export function WheelBars({ values, edit }: WheelsBodyProps) {
  return (
    <div className="flex gap-6">
      {PRIMARY_WHEELS.map(([key, label]) => (
        <WheelBarGroup
          key={key}
          label={label}
          wheel={values[key]}
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

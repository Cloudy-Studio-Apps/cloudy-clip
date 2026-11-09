import { DEFAULT_CORRECTION, ZONE_NAMES } from "@/modules/project";
import { ColorWheel } from "./ColorWheel";
import { GradeSlider } from "./GradeSlider";
import type { WheelsBodyProps } from "./tools.types";
import { wheelEdit } from "./wheel.edit";

const LABELS = ["Black", "Dark", "Shadow", "Light", "Highlight", "Specular"] as const;

/** The six zone wheels, dark to light, each with where its band sits. */
export function ZoneWheels({ values, edit }: WheelsBodyProps) {
  const zones = values.zones;
  return (
    <div className="grid grid-cols-[repeat(3,132px)] gap-x-4 gap-y-4">
      {ZONE_NAMES.map((name, i) => {
        const zone = zones[name];
        const neutral = DEFAULT_CORRECTION.zones[name];
        return (
          <div key={name} className="flex flex-col items-center gap-1.5">
            <ColorWheel
              label={LABELS[i]!}
              wheel={zone}
              size={78}
              numbers="one"
              edit={
                edit.enabled
                  ? wheelEdit(edit, zone, neutral, ({ x, y, m }) => ({
                      values: { zones: { ...zones, [name]: { x, y, m, at: zone.at } } },
                    }))
                  : undefined
              }
            />
            <div title="Where this band sits, from black to white" className="flex w-full">
              <GradeSlider
                bare
                path={`zones.${name}.at`}
                label={`${LABELS[i]!} band`}
                step={0.01}
                value={zone.at}
                resetTo={neutral.at}
                edit={edit}
                patch={(at) => ({ values: { zones: { ...zones, [name]: { ...zone, at } } } })}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

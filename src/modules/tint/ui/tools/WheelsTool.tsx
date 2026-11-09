import { useMemo } from "react";
import { DEFAULT_CORRECTION, type Wheel } from "@/modules/project";
import { ValueSliders } from "./ValueSliders";
import { useToolEdit } from "../tool.edit.hook";
import type { LiveEdit } from "../ui.types";
import { ColorWheel } from "./ColorWheel";
import { PRIMARY_FIELDS } from "./basics.fields";
import type { WheelEdit } from "./tools.types";

const WHEELS = [
  ["lift", "Lift"],
  ["gamma", "Gamma"],
  ["gain", "Gain"],
  ["offset", "Offset"],
] as const;

type WheelKey = (typeof WHEELS)[number][0];

/** The edit of one wheel, from the tool's edit. */
function wheelEdit(edit: LiveEdit, key: WheelKey, current: Wheel): WheelEdit {
  const neutral = DEFAULT_CORRECTION[key];
  return {
    preview: (wheel) => edit.preview({ values: { [key]: wheel } }),
    commit: (wheel) => void edit.commit({ values: { [key]: wheel } }),
    cancel: edit.cancel,
    reset() {
      if (current.x !== neutral.x || current.y !== neutral.y || current.m !== neutral.m) {
        void edit.commit({ values: { [key]: neutral } });
      }
    },
  };
}

/** The primary color wheels (lift, gamma, gain, offset) with temperature, tint, contrast, pivot, saturation and hue beside them. */
export function WheelsTool() {
  const { values, edit } = useToolEdit();
  const edits = useMemo(
    () => WHEELS.map(([key]) => wheelEdit(edit, key, values[key])),
    [edit, values],
  );
  return (
    <div key={edit.rev} className="grid grid-cols-[auto_minmax(260px,400px)] items-start gap-10">
      <div className="grid grid-cols-[repeat(4,128px)] gap-[22px]">
        {WHEELS.map(([key, label], i) => (
          <ColorWheel
            key={key}
            label={label}
            wheel={values[key]}
            size={112}
            edit={edit.enabled ? edits[i] : undefined}
          />
        ))}
      </div>
      <ValueSliders fields={PRIMARY_FIELDS} values={values} edit={edit} />
    </div>
  );
}

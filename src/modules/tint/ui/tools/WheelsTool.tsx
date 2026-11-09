import { SegmentedControl } from "@/ui";
import type { WheelsMode } from "../../tint.types";
import { InfoTip } from "../InfoTip";
import { useToolEdit } from "../tool.edit.hook";
import { useTintView } from "../view.hook";
import { useTintSet } from "../view.set.hook";
import { PRIMARY_FIELDS } from "./basics.fields";
import { LogWheels } from "./LogWheels";
import { PrimaryWheels } from "./PrimaryWheels";
import { ValueSliders } from "./ValueSliders";
import { WheelBars } from "./WheelBars";
import { ZoneWheels } from "./ZoneWheels";

const MODES: { value: WheelsMode; label: string }[] = [
  { value: "primary", label: "Primary" },
  { value: "log", label: "Log" },
  { value: "bars", label: "Bars" },
  { value: "zones", label: "Zones" },
];

const MODE_INFO: Record<WheelsMode, string> = {
  primary: "Lift, gamma and gain overlap across the whole picture, from dark to bright.",
  log: "Shadow, midtone and highlight wheels touch narrow ranges. For footage shot flat.",
  bars: "The same controls as sliders per channel.",
  zones:
    "Six wheels, each for a narrow band of brightness: black, dark, shadow, light, highlight and specular. For HDR and fine work.",
};

const BODIES = { primary: PrimaryWheels, log: LogWheels, bars: WheelBars, zones: ZoneWheels };

/** Color wheels in four modes (`view.wheels`), with temperature, tint, contrast, pivot, saturation and hue beside them. */
export function WheelsTool() {
  const mode = useTintView((v) => v.wheels);
  const set = useTintSet();
  const { values, edit } = useToolEdit();
  const Body = BODIES[mode];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <SegmentedControl<WheelsMode>
          label="Wheels"
          value={mode}
          onChange={(wheels) => set({ wheels })}
          options={MODES}
        />
        <InfoTip text={MODE_INFO[mode]} />
      </div>
      <div key={edit.rev} className="grid grid-cols-[auto_minmax(260px,400px)] items-start gap-10">
        <Body values={values} edit={edit} />
        <ValueSliders fields={PRIMARY_FIELDS} values={values} edit={edit} />
      </div>
    </div>
  );
}

import { SegmentedControl } from "@/ui";
import type { WheelsMode } from "../../tint.types";
import { DEMO_PRIMARIES, DEMO_WHEELS, DEMO_ZONES } from "../demo/demo.values";
import { InfoTip } from "../InfoTip";
import { useTintView } from "../view.hook";
import { useTintSet } from "../view.set.hook";
import { ColorWheel } from "./ColorWheel";
import { DemoSliders } from "./DemoSliders";
import { WheelBars } from "./WheelBars";

const MODE_INFO: Record<WheelsMode, string> = {
  primary: "Lift, gamma and gain overlap across the whole picture, from dark to bright.",
  log: "Shadow, midtone and highlight touch narrow ranges. For footage shot flat.",
  bars: "The same controls as sliders per channel.",
  zones: "Six wheels, each for a narrow band of brightness. For fine work.",
};

function Wheels({ mode }: { mode: WheelsMode }) {
  if (mode === "zones") {
    return (
      <div className="grid grid-cols-[repeat(6,84px)] gap-3.5">
        {DEMO_ZONES.map((wheel) => (
          <ColorWheel key={wheel.label} wheel={wheel} size={78} numbers="one" />
        ))}
      </div>
    );
  }
  if (mode === "bars") return <WheelBars />;
  return (
    <div className="grid grid-cols-[repeat(4,128px)] gap-[22px]">
      {DEMO_WHEELS[mode].map((wheel) => (
        <ColorWheel key={wheel.label} wheel={wheel} size={112} />
      ))}
    </div>
  );
}

/** Color wheels in four modes, with temperature, tint, contrast, pivot, saturation and hue beside them. */
export function WheelsTool() {
  const mode = useTintView((v) => v.wheels);
  const set = useTintSet();
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <SegmentedControl<WheelsMode>
          label="Wheels"
          value={mode}
          onChange={(wheels) => set({ wheels })}
          options={[
            { value: "primary", label: "Primary" },
            { value: "log", label: "Log" },
            { value: "bars", label: "Bars" },
            { value: "zones", label: "Zones" },
          ]}
        />
        <InfoTip text={MODE_INFO[mode]} />
      </div>
      <div className="grid grid-cols-[auto_minmax(260px,400px)] items-start gap-10">
        <Wheels mode={mode} />
        <DemoSliders fields={DEMO_PRIMARIES} />
      </div>
    </div>
  );
}

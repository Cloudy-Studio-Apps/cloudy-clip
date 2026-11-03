import { Pipette, WandSparkles } from "lucide-react";
import { Button } from "@/ui";
import type { DemoField } from "../demo/demo.types";
import { DEMO_CHART } from "../demo/demo.values";
import { DemoSliders } from "./DemoSliders";
import { ToggleLine } from "./ToggleLine";
import { ToolColumn } from "./ToolColumn";
import { ToolColumns } from "./ToolColumns";

const SKIN: readonly DemoField[] = [{ label: "Amount", value: 35, min: 0, max: 100, step: 1 }];

/** Match: balance, match another shot, calibrate from a color chart, pull skin to its line. */
export function MatchTool() {
  return (
    <ToolColumns min={180} gap={28}>
      <ToolColumn title="Balance">
        <div className="flex flex-col items-start gap-2">
          <Button size="sm" title="Auto balance: neutral whites and even exposure in one click">
            <WandSparkles className="size-3.5" /> Auto
          </Button>
          <Button size="sm" title="Pick white: click something white in the viewer">
            <Pipette className="size-3.5" /> White
          </Button>
          <Button size="sm" title="Pick gray: click something gray in the viewer">
            <Pipette className="size-3.5" /> Gray
          </Button>
        </div>
      </ToolColumn>
      <ToolColumn
        title="Another shot"
        info="Click a clip in the strip; this one takes on its colors."
      >
        <div className="flex flex-col items-start gap-2">
          <Button size="sm">Match to 01 Plaza</Button>
          <Button size="sm" title="Match all to this: every selected clip takes this clip's colors">
            <WandSparkles className="size-3.5" /> Match all to this
          </Button>
        </div>
      </ToolColumn>
      <ToolColumn
        title="Color chart"
        info="Film a 24-patch color chart at the start of a shoot. Place its four corners in the viewer, then Calibrate."
      >
        <div className="mb-2.5 grid max-w-[200px] grid-cols-6 gap-[3px] rounded-sm bg-surface-sunken p-1.5">
          {DEMO_CHART.map((color) => (
            <i
              key={color}
              className="block aspect-square rounded-[1px]"
              style={{ background: color }}
            />
          ))}
        </div>
        <div className="flex gap-2">
          <Button size="sm" title="Place the chart's corners in the viewer">
            Place
          </Button>
          <Button size="sm" title="Calibrate: correct the clip so every patch reads right">
            Calibrate
          </Button>
        </div>
      </ToolColumn>
      <ToolColumn title="Skin" info="Pulls faces toward the skin line on the vectorscope.">
        <DemoSliders fields={SKIN} />
        <ToggleLine label="Protect skin" on />
      </ToolColumn>
    </ToolColumns>
  );
}

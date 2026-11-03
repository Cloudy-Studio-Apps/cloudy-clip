import { Camera, Copy, Pipette, WandSparkles } from "lucide-react";
import { DEMO_COLOR, DEMO_LIGHT } from "../demo/demo.values";
import { DemoSliders } from "./DemoSliders";
import { QuickButton } from "./QuickButton";
import { ToggleLine } from "./ToggleLine";
import { ToolColumn } from "./ToolColumn";
import { ToolColumns } from "./ToolColumns";

/** Basics: light, color and the one-click fixes. Where a new grade starts. */
export function BasicsTool() {
  return (
    <ToolColumns>
      <ToolColumn title="Light">
        <DemoSliders fields={DEMO_LIGHT} />
      </ToolColumn>
      <ToolColumn title="Color">
        <DemoSliders fields={DEMO_COLOR} />
        <ToggleLine label="Protect skin" on />
      </ToolColumn>
      <ToolColumn
        title="One click"
        info="Basics and Wheels change the same grade: move a slider here and the wheels follow."
      >
        <div className="flex flex-wrap gap-2.5">
          <QuickButton
            icon={WandSparkles}
            label="Auto balance: neutral whites and even exposure in one click"
          />
          <QuickButton
            icon={Pipette}
            label="Pick something white: click a white or gray spot in the viewer"
          />
          <QuickButton icon={Copy} label="Match to another clip: click a clip in the strip" />
          <QuickButton icon={Camera} label="Apply a look: open Looks and pick one" />
        </div>
      </ToolColumn>
    </ToolColumns>
  );
}

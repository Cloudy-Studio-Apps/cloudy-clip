import { Eye, Minus, Pipette, Plus } from "lucide-react";
import { useState } from "react";
import { Button, IconButton, SegmentedControl, Switch } from "@/ui";
import type { DemoField } from "../demo/demo.types";
import { DemoSliders } from "./DemoSliders";
import { RangeBar } from "./RangeBar";
import { ToolColumn } from "./ToolColumn";
import { ToolColumns } from "./ToolColumns";

const HUE = "linear-gradient(90deg, red, #ff0, lime, cyan, blue, #f0f, red)";
const SAT = "linear-gradient(90deg, #888, #e05a3a)";
const LUM = "linear-gradient(90deg, #000, #fff)";

const SOFT: readonly DemoField[] = [{ label: "Softness", value: 30, min: 0, max: 100, step: 1 }];
const REFINE: readonly DemoField[] = [
  { label: "Softness", value: 30, min: 0, max: 100, step: 1 },
  { label: "Clean up", value: 20, min: 0, max: 100, step: 1 },
];

const nothing = () => {};

/** Limit: change only the colors you pick, or a band of brightness. Without a limit, the whole frame. */
export function LimitTool() {
  const [byColor, setByColor] = useState(true);
  const [byBrightness, setByBrightness] = useState(false);
  const [band, setBand] = useState<"darks" | "mids" | "brights">("brights");
  return (
    <ToolColumns>
      <ToolColumn
        title="By color"
        info="Pick a color in the picture with the dropper; only those colors change. + and − add or leave out more."
      >
        <div className="mb-2 flex items-center gap-2">
          <Switch label="Limit by color" checked={byColor} onChange={setByColor} />
          <span className="flex-1" />
          <IconButton label="Pick: click a color in the viewer" active onClick={nothing}>
            <Pipette />
          </IconButton>
          <IconButton label="Add: click more colors to include them" onClick={nothing}>
            <Plus />
          </IconButton>
          <IconButton label="Leave out: click colors to remove them" onClick={nothing}>
            <Minus />
          </IconButton>
        </div>
        <RangeBar label="Hue" background={HUE} from={4} to={14} />
        <RangeBar label="Saturation" background={SAT} from={22} to={64} />
        <RangeBar label="Brightness" background={LUM} from={30} to={82} />
      </ToolColumn>
      <ToolColumn
        title="By brightness"
        info="Only the darks, only the brights, or a band in between. No picking needed."
      >
        <div className="mb-2 flex items-center gap-3">
          <Switch label="Limit by brightness" checked={byBrightness} onChange={setByBrightness} />
          <span className="flex-1" />
          <SegmentedControl<"darks" | "mids" | "brights">
            label="Band"
            value={band}
            onChange={setBand}
            options={[
              { value: "darks", label: "Darks" },
              { value: "mids", label: "Mids" },
              { value: "brights", label: "Brights" },
            ]}
          />
        </div>
        <RangeBar label="Range" background={LUM} from={70} to={100} />
        <DemoSliders fields={SOFT} />
      </ToolColumn>
      <ToolColumn
        title="Refine"
        info="Soften and clean the edge of what was picked, then check it."
      >
        <DemoSliders fields={REFINE} />
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" title="Show what is picked: picked areas white, the rest black">
            <Eye className="size-3.5" /> Show
          </Button>
          <Button size="sm" title="Invert: change everything except what was picked">
            Invert
          </Button>
          <Button size="sm" title="Use the pick of another layer, so both change the same colors">
            Use the pick of…
          </Button>
        </div>
      </ToolColumn>
    </ToolColumns>
  );
}

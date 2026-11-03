import type { DemoField } from "../demo/demo.types";
import { ColorWheel } from "./ColorWheel";
import { DemoSliders } from "./DemoSliders";
import { ToolColumn } from "./ToolColumn";
import { ToolColumns } from "./ToolColumns";

const BALANCE: readonly DemoField[] = [
  { label: "Balance", value: 0, min: -100, max: 100, step: 1 },
];
const FILM: readonly DemoField[] = [
  { label: "Faded film", value: 12, min: 0, max: 100, step: 1 },
  { label: "Vibrance", value: 0, min: -100, max: 100, step: 1 },
];
const VIGNETTE: readonly DemoField[] = [
  { label: "Amount", value: -28, min: -100, max: 100, step: 1 },
  { label: "Midpoint", value: 50, min: 0, max: 100, step: 1 },
  { label: "Roundness", value: 0, min: -100, max: 100, step: 1 },
  { label: "Feather", value: 50, min: 0, max: 100, step: 1 },
];

const tint = (label: string, x: number, y: number) => ({
  label,
  x,
  y,
  numbers: [0, 0, 0, 0] as [number, number, number, number],
  master: 0,
});

/** Creative: split toning, faded film and a vignette. */
export function CreativeTool() {
  return (
    <ToolColumns>
      <ToolColumn
        title="Split toning"
        info="Tint the shadows and the highlights with different colors, like teal shadows and warm highlights."
      >
        <div className="mb-3 flex gap-4">
          <ColorWheel wheel={tint("Shadow tint", -0.35, 0.3)} size={84} numbers="one" />
          <ColorWheel wheel={tint("Highlight tint", 0.25, -0.3)} size={84} numbers="one" />
        </div>
        <DemoSliders fields={BALANCE} />
      </ToolColumn>
      <ToolColumn title="Film">
        <DemoSliders fields={FILM} />
      </ToolColumn>
      <ToolColumn
        title="Vignette"
        info="Darken or lighten the edges to pull the eye to the middle."
      >
        <DemoSliders fields={VIGNETTE} />
      </ToolColumn>
    </ToolColumns>
  );
}

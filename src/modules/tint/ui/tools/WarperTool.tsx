import { Button } from "@/ui";
import type { DemoField } from "../demo/demo.types";
import { DemoSliders } from "./DemoSliders";
import { ToolColumn } from "./ToolColumn";
import { WarperGrid } from "./WarperGrid";

const FIELDS: readonly DemoField[] = [
  { label: "Smoothing", value: 50, min: 0, max: 100, step: 1 },
  { label: "Grid", value: 12, min: 6, max: 24, step: 1 },
];

/** Warper: a grid of points over hue and strength; drag one to bend that color. */
export function WarperTool() {
  return (
    <div className="grid grid-cols-[232px_minmax(240px,360px)] items-start gap-11">
      <WarperGrid />
      <ToolColumn
        title="Warper"
        info="Each point is a color. Drag it toward another hue to shift that color, or in and out to change its strength. Neighbors follow smoothly."
      >
        <DemoSliders fields={FIELDS} />
        <div className="mt-3 flex gap-2">
          <Button size="sm" title="Pin: lock a point so dragging others leaves it alone">
            Pin
          </Button>
          <Button size="sm" title="Reset: put every point back">
            Reset
          </Button>
        </div>
      </ToolColumn>
    </div>
  );
}

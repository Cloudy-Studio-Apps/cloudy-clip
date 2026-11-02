import { useState } from "react";
import { useKernel } from "@/core";
import { useOpenFormat } from "@/modules/project";
import { Button, ColorField, Dialog, NumberField } from "@/ui";
import { createSolid } from "../solid.commands";

const QUICK_COLORS = [
  "#000000",
  "#ffffff",
  "#e8772e",
  "#f0a43a",
  "#e3bd2f",
  "#b7c936",
  "#6f9a3a",
  "#3f9b6e",
  "#2aa5a0",
  "#2f6fb0",
  "#5f9fd6",
  "#8f7ac8",
  "#d4488f",
  "#e88fb5",
  "#c9b79a",
  "#d9a77e",
  "#a8722a",
  "#8a5a3c",
];

/** Name, colour and size of a new solid. It starts at the open composition's size. */
export function SolidDialog({ onClose }: { onClose(): void }) {
  const { bus } = useKernel();
  const format = useOpenFormat();
  const [name, setName] = useState("Solid color");
  const [color, setColor] = useState("#2f6fb0");
  const [width, setWidth] = useState(format.width);
  const [height, setHeight] = useState(format.height);

  const create = async () => {
    const result = await bus.run(createSolid, { name, color, width, height });
    if (result.ok) onClose();
  };
  return (
    <Dialog
      title="New solid color"
      onClose={onClose}
      footer={
        <>
          <Button size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="primary"
            disabled={name.trim() === ""}
            onClick={() => void create()}
          >
            Create
          </Button>
        </>
      }
    >
      <div
        className="h-16 shadow-[0_0_0_1px_var(--border-strong)]"
        style={{ backgroundColor: color }}
      />
      <label className="grid grid-cols-[64px_minmax(0,1fr)] items-center gap-2 text-sm text-muted-foreground">
        Name
        <input
          aria-label="Name"
          value={name}
          spellCheck={false}
          onChange={(event) => setName(event.target.value)}
          className="h-[26px] min-w-0 border-b border-border-strong bg-transparent px-1 text-[13px] text-foreground outline-none focus:border-ring"
        />
      </label>
      <ColorField
        label="Color"
        color={color}
        swatches={QUICK_COLORS}
        onChange={(next) => setColor(next)}
      />
      <div className="grid grid-cols-[64px_minmax(0,1fr)_minmax(0,1fr)] items-center gap-2 text-sm text-muted-foreground">
        Size
        <NumberField
          label="Width"
          prefix="W"
          value={width}
          min={1}
          max={16384}
          onChange={setWidth}
        />
        <NumberField
          label="Height"
          prefix="H"
          value={height}
          min={1}
          max={16384}
          onChange={setHeight}
        />
      </div>
    </Dialog>
  );
}

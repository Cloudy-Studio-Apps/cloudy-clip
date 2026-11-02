import { useState } from "react";
import { useKernel, useModule } from "@/core";
import { mediaRef } from "@/modules/media";
import { DEFAULT_GRADIENT, gradientCss } from "@/modules/element";
import { useOpenFormat, type Gradient, type Solid } from "@/modules/project";
import {
  Button,
  ColorField,
  Dialog,
  GradientField,
  NumberField,
  SegmentedControl,
  Switch,
} from "@/ui";
import { createSolid, updateSolid } from "../solid.commands";

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

const FILLS = [
  { value: "color", label: "Color" },
  { value: "gradient", label: "Gradient" },
] as const;

/** Name, fill and size of a new solid, or of `solid`. A new one matches the frame. */
export function SolidDialog({ solid, onClose }: { solid?: Solid; onClose(): void }) {
  const { bus } = useKernel();
  const media = useModule(mediaRef);
  const format = useOpenFormat();
  const [name, setName] = useState(solid?.name ?? "Solid color");
  const [color, setColor] = useState(solid?.color ?? "#2f6fb0");
  const [fillType, setFillType] = useState(solid?.fillType ?? "color");
  const [gradient, setGradient] = useState<Gradient>(solid?.gradient ?? { ...DEFAULT_GRADIENT });
  const [matchFrame, setMatchFrame] = useState(solid ? solid.width === undefined : true);
  const [width, setWidth] = useState(solid?.width ?? format.width);
  const [height, setHeight] = useState(solid?.height ?? format.height);

  const save = async () => {
    const values = { name, color, fillType, gradient };
    if (solid) {
      const size = matchFrame ? { width: null, height: null } : { width, height };
      const result = await bus.run(updateSolid, { solidId: solid.id, ...values, ...size });
      if (result.ok) onClose();
      return;
    }
    const { place } = media.view.getState();
    const binId = place.kind === "bin" ? (place.binId ?? undefined) : undefined;
    const size = matchFrame ? {} : { width, height };
    const result = await bus.run(createSolid, { ...values, ...size, binId });
    if (result.ok) onClose();
  };
  return (
    <Dialog
      title={solid ? "Edit solid color" : "New solid color"}
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
            onClick={() => void save()}
          >
            {solid ? "Save" : "Create"}
          </Button>
        </>
      }
    >
      <div
        className="h-16 shadow-[0_0_0_1px_var(--border-strong)]"
        style={{ background: fillType === "gradient" ? gradientCss(gradient) : color }}
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
      <SegmentedControl
        label="Fill"
        options={FILLS}
        value={fillType}
        onChange={(next) => setFillType(next)}
      />
      {fillType === "color" ? (
        <ColorField
          label="Color"
          color={color}
          swatches={QUICK_COLORS}
          onChange={(next) => setColor(next)}
        />
      ) : (
        <GradientField
          label="Gradient"
          value={gradient}
          swatches={QUICK_COLORS}
          onChange={(next, info) => {
            if (info.done) setGradient(next);
          }}
        />
      )}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        Match frame
        <Switch label="Match frame" checked={matchFrame} onChange={setMatchFrame} />
      </div>
      {!matchFrame && (
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
      )}
    </Dialog>
  );
}

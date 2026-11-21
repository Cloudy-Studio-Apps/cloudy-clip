import {
  Ban,
  FlipHorizontal2,
  Circle,
  Heart,
  PenTool,
  Pencil,
  Square,
  SquareSplitHorizontal,
  Star,
} from "lucide-react";
import { useStore } from "zustand";
import { useModule } from "@/core";
import { useVisibleLayers } from "@/modules/transform";
import {
  IDENTITY_TRANSFORM,
  clipPlacement,
  formatOf,
  projectRef,
  type Clip,
} from "@/modules/project";
import { Button, SegmentedControl } from "@/ui";
import { maskRef } from "../mask.ref";
import type { MaskPreset } from "../mask.types";
import type { useMaskEdit } from "./mask.edit.hook";

const OPTIONS = [
  { value: "none", label: "", hint: "None: remove the masks", icon: Ban },
  { value: "linear", label: "", hint: "Linear", icon: SquareSplitHorizontal },
  { value: "mirror", label: "", hint: "Mirror", icon: FlipHorizontal2 },
  { value: "ellipse", label: "", hint: "Ellipse", icon: Circle },
  { value: "rectangle", label: "", hint: "Rectangle", icon: Square },
  { value: "star", label: "", hint: "Star", icon: Star },
  { value: "heart", label: "", hint: "Heart", icon: Heart },
];

/** The preset buttons and the drawing tools: they add to every selected picture clip. */
export function MaskPresets({ clip, edit }: { clip: Clip; edit: ReturnType<typeof useMaskEdit> }) {
  const project = useModule(projectRef).store;
  const { ui } = useModule(maskRef);
  const drawing = useStore(ui, (s) => s.drawing);
  const layer = useVisibleLayers().find((l) => l.clipId === clip.id);

  const choose = (value: string) => {
    const clipIds = edit.targets();
    if (value === "none") {
      for (const clipId of clipIds) void edit.run("mask.remove", { clipId, maskIds: [] });
      return;
    }
    // Half the layer's fitted size; off screen, the command's own default (half the frame) stands.
    const fitted =
      layer &&
      clipPlacement(
        formatOf(project.getState(), clip),
        layer.source,
        IDENTITY_TRANSFORM,
        layer.fit,
      );
    const sized = fitted && value !== "linear" && value !== "mirror";
    void edit
      .run("mask.add", {
        clipIds,
        preset: value as MaskPreset,
        ...(sized && { values: { width: fitted.width / 2, height: fitted.height / 2 } }),
      })
      .then((added) => {
        const { maskIds } = (added?.value ?? {}) as { maskIds?: Record<string, string> };
        const created = maskIds?.[clip.id];
        if (created) ui.setState({ selectedMaskId: created, selectedPointId: null });
      });
  };

  const draw = (mode: "pen" | "freehand") =>
    ui.setState({ drawing: drawing?.mode === mode ? null : { mode } });

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <SegmentedControl
        label="Mask presets"
        options={OPTIONS}
        value={undefined}
        className="gap-2.5"
        onChange={choose}
      />
      <div className="flex gap-1.5">
        <Button
          size="sm"
          variant={drawing?.mode === "pen" ? "primary" : "secondary"}
          onClick={() => draw("pen")}
        >
          <PenTool /> Pen
        </Button>
        <Button
          size="sm"
          variant={drawing?.mode === "freehand" ? "primary" : "secondary"}
          onClick={() => draw("freehand")}
        >
          <Pencil /> Freehand
        </Button>
      </div>
    </div>
  );
}

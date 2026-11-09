import { Pipette } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { CorrectionValues } from "@/modules/project";
import { Button, cn } from "@/ui";
import { pickHuePoints } from "../../logic/color/curves.edit";
import type { CurveKind, CurvePoint, CurveShape } from "../../tint.types";
import { useToolEdit } from "../tool.edit.hook";
import { useTintView } from "../view.hook";
import { useTintSet } from "../view.set.hook";
import { CHANNEL_COLORS } from "./channel.colors";
import { CurveEditor } from "./CurveEditor";
import type { CurveEdit } from "./tools.types";

const KINDS: readonly { kind: CurveKind; name: string }[] = [
  { kind: "custom", name: "Custom" },
  { kind: "hueHue", name: "Hue vs Hue" },
  { kind: "hueSat", name: "Hue vs Saturation" },
  { kind: "hueLum", name: "Hue vs Brightness" },
  { kind: "lumSat", name: "Brightness vs Saturation" },
];

const CHANNELS = ["y", "r", "g", "b"] as const;
type Channel = (typeof CHANNELS)[number];

const STROKES: Record<Channel, string> = {
  y: "var(--foreground)",
  r: CHANNEL_COLORS[0],
  g: CHANNEL_COLORS[1],
  b: CHANNEL_COLORS[2],
};

const shapeOf = (kind: CurveKind): CurveShape =>
  kind === "custom" ? "tone" : kind === "lumSat" ? "flat" : "hue";

type Curves = CorrectionValues["curves"];

/** The curves with the open one replaced by `points`. */
function withCurve(
  curves: Curves,
  kind: CurveKind,
  channel: Channel,
  points: readonly CurvePoint[],
): Curves {
  const next = points.map(([x, y]): [number, number] => [x, y]);
  return kind === "custom"
    ? { ...curves, rgb: { ...curves.rgb, [channel]: next } }
    : { ...curves, [kind]: next };
}

/** Curves: the custom curves (Y, R, G, B) and the four hue and brightness curves, on the selected correction. */
export function CurvesTool() {
  const kind = useTintView((v) => v.curve);
  const picking = useTintView((v) => v.picking);
  const picked = useTintView((v) => v.picked);
  const set = useTintSet();
  const { values, edit } = useToolEdit();
  const [channel, setChannel] = useState<Channel>("y");
  const shape = shapeOf(kind);
  const points = kind === "custom" ? values.curves.rgb[channel] : values.curves[kind];

  const curveEdit = useMemo((): CurveEdit => {
    const patch = (next: readonly CurvePoint[]) => ({
      values: { curves: withCurve(values.curves, kind, channel, next) },
    });
    return {
      preview: (next) => edit.preview(patch(next)),
      commit: (next) => void edit.commit(patch(next)),
      cancel: edit.cancel,
    };
  }, [edit, values.curves, kind, channel]);

  // A hue picked in the viewer is fenced in with points on the open hue curve.
  useEffect(() => {
    if (picked === null) return;
    set({ picked: null });
    if (shape !== "hue" || !edit.enabled) return;
    const next = pickHuePoints(points, picked);
    if (next) curveEdit.commit(next);
  }, [picked, set, shape, edit.enabled, points, curveEdit]);

  // Leaving the tool stops a pick that hasn't happened.
  useEffect(() => () => set({ picking: false }), [set]);

  return (
    <div key={edit.rev} className="grid max-w-[780px] grid-cols-[minmax(0,560px)_180px] gap-6">
      <CurveEditor
        points={points}
        shape={shape}
        color={kind === "custom" ? STROKES[channel] : "var(--foreground)"}
        edit={edit.enabled ? curveEdit : undefined}
      />
      <div className="flex flex-col gap-1">
        {KINDS.map((entry) => (
          <button
            key={entry.kind}
            type="button"
            onClick={() => set({ curve: entry.kind, picking: false })}
            className={cn(
              "cursor-pointer rounded-sm px-2.5 py-1.5 text-left font-hand text-sm font-bold",
              kind === entry.kind
                ? "bg-muted text-foreground shadow-[inset_2px_0_0_var(--mark)]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {entry.name}
          </button>
        ))}
        {kind === "custom" && (
          <div className="mt-2 flex gap-1" role="group" aria-label="Channel">
            {CHANNELS.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={channel === c}
                onClick={() => setChannel(c)}
                className={cn(
                  "h-[22px] w-6 cursor-pointer rounded-xs font-mono text-xs font-bold uppercase",
                  channel === c
                    ? "bg-foreground text-background"
                    : "shadow-[inset_0_0_0_1px_var(--border-strong)]",
                )}
              >
                {c}
              </button>
            ))}
          </div>
        )}
        {shape === "hue" && (
          <Button
            size="sm"
            className="mt-2 self-start"
            disabled={!edit.enabled}
            aria-pressed={picking}
            title={
              picking
                ? "Click a color in the viewer (Escape stops)"
                : "Pick hue: click a color in the viewer to put points around its hue"
            }
            onClick={() => set({ picking: !picking })}
          >
            <Pipette className="size-3.5" /> {picking ? "Picking…" : "Pick hue"}
          </Button>
        )}
      </div>
    </div>
  );
}

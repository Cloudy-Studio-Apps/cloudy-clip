import { Pipette } from "lucide-react";
import { Button, cn } from "@/ui";
import type { CurveKind } from "../../tint.types";
import { DEMO_CURVE, DEMO_HUE_CURVE } from "../demo/demo.values";
import { useTintView } from "../view.hook";
import { useTintSet } from "../view.set.hook";
import { CurveEditor } from "./CurveEditor";

const KINDS: readonly { kind: CurveKind; name: string }[] = [
  { kind: "custom", name: "Custom" },
  { kind: "hueHue", name: "Hue vs Hue" },
  { kind: "hueSat", name: "Hue vs Saturation" },
  { kind: "hueLum", name: "Hue vs Brightness" },
  { kind: "lumSat", name: "Brightness vs Saturation" },
];

const CHANNELS = ["Y", "R", "G", "B"] as const;

/** Curves: the custom RGB curve and the four hue and brightness curves. */
export function CurvesTool() {
  const curve = useTintView((v) => v.curve);
  const set = useTintSet();
  const custom = curve === "custom";
  return (
    <div className="grid max-w-[780px] grid-cols-[minmax(0,560px)_180px] gap-6">
      <CurveEditor points={custom ? DEMO_CURVE : DEMO_HUE_CURVE} hue={!custom} />
      <div className="flex flex-col gap-1">
        {KINDS.map(({ kind, name }) => (
          <button
            key={kind}
            type="button"
            onClick={() => set({ curve: kind })}
            className={cn(
              "cursor-pointer rounded-sm px-2.5 py-1.5 text-left font-hand text-sm font-bold",
              curve === kind
                ? "bg-muted text-foreground shadow-[inset_2px_0_0_var(--mark)]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {name}
          </button>
        ))}
        {custom ? (
          <div className="mt-2 flex gap-1">
            {CHANNELS.map((c, i) => (
              <button
                key={c}
                type="button"
                className={cn(
                  "h-[22px] w-6 cursor-pointer rounded-xs font-mono text-xs font-bold",
                  i === 0
                    ? "bg-foreground text-background"
                    : "shadow-[inset_0_0_0_1px_var(--border-strong)]",
                )}
              >
                {c}
              </button>
            ))}
          </div>
        ) : (
          <Button
            size="sm"
            className="mt-2 self-start"
            title="Pick hue: click a color in the viewer"
          >
            <Pipette className="size-3.5" /> Pick hue
          </Button>
        )}
      </div>
    </div>
  );
}

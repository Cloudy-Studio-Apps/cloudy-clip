import { curvePath } from "../../logic/color/curves";

/** Hue strip along a hue curve's bottom (data colors). */
const HUES = "linear-gradient(90deg, red, #ff0, lime, cyan, blue, #f0f, red)";

interface CurveEditorProps {
  points: readonly (readonly [number, number])[];
  /** A hue curve: flat at the middle, with the hue strip under it. */
  hue: boolean;
}

/** A curve over its grid with its points. Click adds, drag moves, drag off removes (not yet). */
export function CurveEditor({ points, hue }: CurveEditorProps) {
  const size = 100;
  return (
    <div className="relative h-[220px] rounded-sm bg-background shadow-[inset_0_0_0_1px_var(--border)]">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        preserveAspectRatio="none"
        className="absolute inset-0 size-full"
      >
        {[25, 50, 75].map((at) => (
          <path
            key={at}
            d={`M0 ${at}H${size}M${at} 0V${size}`}
            stroke="var(--border)"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <path
          d={hue ? `M0 50H${size}` : `M0 ${size}L${size} 0`}
          stroke="var(--border-strong)"
          strokeDasharray="3 3"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={curvePath(points, size, size)}
          fill="none"
          stroke="var(--foreground)"
          strokeWidth={1.8}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {points.map(([x, y]) => (
        <span
          key={`${x}-${y}`}
          className="absolute size-2.5 -translate-1/2 rounded-full bg-foreground"
          style={{ left: `${x * 100}%`, top: `${(1 - y) * 100}%` }}
        />
      ))}
      {hue && (
        <span
          className="absolute inset-x-0 bottom-0 h-2.5 opacity-80"
          style={{ background: HUES }}
        />
      )}
    </div>
  );
}

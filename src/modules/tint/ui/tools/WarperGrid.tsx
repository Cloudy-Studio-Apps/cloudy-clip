/** The hue circle under the grid (data colors), neutral in the middle. */
const DISC =
  "radial-gradient(circle, #d9dde0 0, rgb(217 221 224 / 0) 72%), conic-gradient(from 90deg, hsl(0 70% 55%), hsl(60 70% 55%), hsl(120 60% 50%), hsl(180 60% 50%), hsl(240 65% 60%), hsl(300 65% 58%), hsl(360 70% 55%))";

const HUES = 12;
const RINGS = 3;
const STEP = 36;

/** Grid points by ring and spoke; one skin-tone point is moved, to show a warp. */
function points(): { x: number; y: number; moved: boolean }[][] {
  return Array.from({ length: RINGS }, (_, r) =>
    Array.from({ length: HUES }, (_, a) => {
      const angle = (a / HUES) * Math.PI * 2;
      const moved = r === 1 && a === 4;
      return {
        x: Math.cos(angle) * (r + 1) * STEP + (moved ? 9 : 0),
        y: Math.sin(angle) * (r + 1) * STEP - (moved ? 6 : 0),
        moved,
      };
    }),
  );
}

const GRID = points();

/** The warper's grid over the color circle. */
export function WarperGrid() {
  return (
    <div
      className="size-[232px] rounded-full shadow-[0_0_0_1px_var(--border-strong)]"
      style={{ background: DISC }}
    >
      <svg viewBox="-120 -120 240 240" className="size-full overflow-visible">
        <g stroke="rgb(20 23 27 / 0.7)" fill="none">
          {GRID.map((ring, r) => (
            <polygon key={r} points={ring.map((p) => `${p.x},${p.y}`).join(" ")} />
          ))}
          {GRID[0]!.map((_, a) => (
            <polyline
              key={a}
              points={["0,0", ...GRID.map((ring) => `${ring[a]!.x},${ring[a]!.y}`)].join(" ")}
            />
          ))}
        </g>
        <circle r={4.5} fill="var(--foreground)" stroke="var(--background)" strokeWidth={1.5} />
        {GRID.flat().map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={3.8}
            fill={p.moved ? "var(--mark)" : "var(--foreground)"}
            stroke="var(--background)"
            strokeWidth={1.5}
            className="cursor-grab"
          />
        ))}
      </svg>
    </div>
  );
}

import { wirePath } from "../logic/wires";
import type { GraphWire } from "../tint.types";
import { CHANNEL_COLORS } from "./tools/channel.colors";

/** Data colors of the channel wires. */
const WIRE_COLORS = {
  picture: "var(--subtle-foreground)",
  r: CHANNEL_COLORS[0],
  g: CHANNEL_COLORS[1],
  b: CHANNEL_COLORS[2],
  key: CHANNEL_COLORS[2],
} as const;

interface GraphWiresProps {
  wires: GraphWire[];
  /** A right-click on wire `index` (its index in `wires`). */
  onHit(index: number): void;
}

/**
 * The wires of the Leader Seal graph, drawn as SVG paths: each wire, then a wide transparent copy
 * of it on top that takes the right-click (which wire it was, through `onHit`).
 */
export function GraphWires({ wires, onHit }: GraphWiresProps) {
  return (
    <>
      {wires.map((w, i) => (
        <path
          key={`${w.from}-${w.to}-${i}`}
          data-wire={i}
          d={wirePath(w.a, w.b)}
          fill="none"
          stroke={WIRE_COLORS[w.kind]}
          strokeWidth={1.8}
          strokeDasharray={w.kind === "key" ? "5 4" : undefined}
        />
      ))}
      {wires.map((w, i) => (
        <path
          key={`hit-${w.from}-${w.to}-${i}`}
          data-wire={i}
          d={wirePath(w.a, w.b)}
          fill="none"
          stroke="transparent"
          strokeWidth={12}
          pointerEvents="stroke"
          onContextMenu={() => onHit(i)}
        />
      ))}
    </>
  );
}

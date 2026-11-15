import type { PointerEvent } from "react";
import type { GradeNode, NodeRef } from "@/modules/project";
import { inPort, nodeBox, outPort } from "../logic/graph";

/** Data colors of the channels. */
const CHANNEL_COLORS = { r: "#e0545a", g: "#4fbf6a", b: "#4d8fe0" } as const;
const CHANNELS = ["r", "g", "b"] as const;

const GLYPHS = { parallel: "∥", layer: "≡", split: "⑃", join: "⑂", keyJoin: "⚷" } as const;
const NAMES = {
  parallel: "Side by side",
  layer: "Stacked",
  split: "Split",
  join: "Join",
  keyJoin: "Shared key",
} as const;

interface NodeBoxProps {
  id: string;
  node: GradeNode;
  /** Where it sits, in graph units. */
  at: { x: number; y: number };
  /** Its number in the list ("01"), for a correction. */
  no?: string;
  /** The picture after it, once drawn. */
  thumb?: string;
  selected: boolean;
  /** A press on the body: select and start moving. */
  onPress(event: PointerEvent, id: string): void;
  /** A press on an output port: start a wire from that picture. */
  onPort(event: PointerEvent, from: NodeRef): void;
  onRemove(id: string): void;
}

/** One node of the graph: a correction with its picture, or a join, split or key join joint. */
export function NodeBox({
  id,
  node,
  at,
  no,
  thumb,
  selected,
  onPress,
  onPort,
  onRemove,
}: NodeBoxProps) {
  const placed = { kind: node.kind, ...at };
  const b = nodeBox(placed);
  const stroke = selected ? "var(--mark)" : "var(--border-strong)";
  const outs = node.kind === "split" ? CHANNELS : [undefined];
  const ins = node.kind === "join" ? CHANNELS : [undefined];
  const correction = node.kind === "correct";
  return (
    <g
      data-node
      data-node-id={id}
      tabIndex={0}
      className="cursor-pointer outline-none"
      onPointerDown={(event) => onPress(event, id)}
      onKeyDown={(event) => {
        if (event.key === "Delete" || event.key === "Backspace") onRemove(id);
      }}
    >
      <rect
        x={b.x}
        y={b.y}
        width={b.width}
        height={b.height}
        rx={correction ? 4 : b.width / 2}
        fill="var(--muted)"
        stroke={stroke}
        strokeWidth={selected ? 2.2 : 1.5}
        opacity={correction && !node.on ? 0.6 : 1}
      />
      {correction ? (
        <>
          {thumb && (
            <image
              href={thumb}
              x={b.x + 4}
              y={b.y + 4}
              width={b.width - 8}
              height={b.height - 28}
              preserveAspectRatio="xMidYMid slice"
              opacity={node.on ? 1 : 0.45}
            />
          )}
          {(node.limit || node.lut) && (
            <>
              <rect
                x={b.x + b.width - 48}
                y={b.y + 6}
                width={42}
                height={13}
                rx={2}
                fill="var(--surface-sunken)"
                opacity={0.85}
              />
              <text
                x={b.x + b.width - 27}
                y={b.y + 16}
                textAnchor="middle"
                className="fill-primary font-mono text-2xs font-bold"
              >
                {node.limit ? "KEY" : "LUT"}
              </text>
            </>
          )}
          <text
            x={b.x + 7}
            y={b.y + b.height - 8}
            className="fill-subtle-foreground font-mono text-xs"
          >
            {no}
          </text>
          <text
            x={b.x + 27}
            y={b.y + b.height - 8}
            className="fill-foreground font-hand text-base font-bold"
          >
            {node.name || "Correction"}
          </text>
        </>
      ) : (
        <>
          <text
            x={b.x + b.width / 2}
            y={b.y + 26}
            textAnchor="middle"
            className="fill-foreground font-hand text-md font-bold"
          >
            {GLYPHS[node.kind]}
          </text>
          <text
            x={b.x + b.width / 2}
            y={b.y + b.height + 14}
            textAnchor="middle"
            className="fill-subtle-foreground font-mono text-xs"
          >
            {NAMES[node.kind]}
          </text>
        </>
      )}
      {ins.map((channel) => {
        const [x, y] = inPort(placed, channel);
        return (
          <circle
            key={channel ?? "in"}
            cx={x}
            cy={y}
            r={4}
            fill={channel ? CHANNEL_COLORS[channel] : "var(--subtle-foreground)"}
          />
        );
      })}
      {outs.map((channel) => {
        const [x, y] = outPort(placed, channel);
        return (
          <circle
            key={channel ?? "out"}
            data-port
            cx={x}
            cy={y}
            r={5}
            fill="var(--surface)"
            stroke={channel ? CHANNEL_COLORS[channel] : "var(--subtle-foreground)"}
            strokeWidth={1.5}
            className="cursor-crosshair"
            onPointerDown={(event) => {
              event.stopPropagation();
              onPort(event, { node: id, ...(channel ? { channel } : {}) });
            }}
          />
        );
      })}
    </g>
  );
}

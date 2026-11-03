import { nodeBox } from "../logic/graph";
import { DEMO_FRAME } from "./demo/demo.images";
import type { DemoNode } from "./demo/demo.types";

/** Data colors of the channel nodes. */
const CHANNEL_COLORS = { r: "#e0545a", g: "#4fbf6a", b: "#4d8fe0" } as const;

interface NodeBoxProps {
  node: DemoNode;
  selected: boolean;
  onSelect(): void;
}

/** One node of the graph: a correction with its picture, a channel, or a join/split joint. */
export function NodeBox({ node, selected, onSelect }: NodeBoxProps) {
  const b = nodeBox(node);
  const stroke = selected ? "var(--mark)" : "var(--border-strong)";
  const ports = (
    <>
      <circle cx={b.x} cy={b.y + b.height / 2} r={4} fill="var(--subtle-foreground)" />
      <circle
        cx={b.x + b.width}
        cy={b.y + b.height / 2}
        r={4}
        fill="var(--surface)"
        stroke="var(--subtle-foreground)"
        strokeWidth={1.5}
      />
    </>
  );
  if (node.kind === "join" || node.kind === "split" || node.kind === "merge") {
    const glyph = node.kind === "join" ? "∥" : node.kind === "split" ? "⑃" : "⑂";
    return (
      <g data-node className="cursor-pointer" onClick={onSelect}>
        <rect
          x={b.x}
          y={b.y}
          width={b.width}
          height={b.height}
          rx={b.width / 2}
          fill="var(--muted)"
          stroke={stroke}
          strokeWidth={selected ? 2.2 : 1.5}
        />
        <text
          x={b.x + b.width / 2}
          y={b.y + 26}
          textAnchor="middle"
          className="fill-foreground font-hand text-md font-bold"
        >
          {glyph}
        </text>
        <text
          x={b.x + b.width / 2}
          y={b.y + 56}
          textAnchor="middle"
          className="fill-subtle-foreground font-mono text-xs"
        >
          {node.label}
        </text>
      </g>
    );
  }
  if (node.kind === "channel") {
    return (
      <g data-node className="cursor-pointer" onClick={onSelect}>
        <rect
          x={b.x}
          y={b.y}
          width={b.width}
          height={b.height}
          rx={4}
          fill="var(--muted)"
          stroke={stroke}
          strokeWidth={selected ? 2.2 : 1.5}
        />
        <rect
          x={b.x + 6}
          y={b.y + 8}
          width={6}
          height={22}
          rx={1}
          fill={CHANNEL_COLORS[node.channel ?? "r"]}
        />
        <text x={b.x + 17} y={b.y + 24} className="fill-foreground font-hand text-sm font-bold">
          {node.label}
        </text>
        {ports}
      </g>
    );
  }
  return (
    <g data-node className="cursor-pointer" onClick={onSelect}>
      <rect
        x={b.x}
        y={b.y}
        width={b.width}
        height={b.height}
        rx={4}
        fill="var(--muted)"
        stroke={stroke}
        strokeWidth={selected ? 2.2 : 1.5}
      />
      <image
        href={DEMO_FRAME}
        x={b.x + 4}
        y={b.y + 4}
        width={b.width - 8}
        height={b.height - 28}
        preserveAspectRatio="xMidYMid slice"
        style={{ filter: "contrast(1.1) sepia(0.12)" }}
      />
      {node.badge && (
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
            {node.badge}
          </text>
        </>
      )}
      <text x={b.x + 7} y={b.y + b.height - 8} className="fill-subtle-foreground font-mono text-xs">
        {node.no}
      </text>
      <text
        x={b.x + 27}
        y={b.y + b.height - 8}
        className="fill-foreground font-hand text-base font-bold"
      >
        {node.label}
      </text>
      {ports}
    </g>
  );
}

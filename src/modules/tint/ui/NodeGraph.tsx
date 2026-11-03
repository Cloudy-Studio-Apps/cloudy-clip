import { ContextMenu, type MenuItem } from "@/ui";
import { TINT_LAYOUT } from "../tint.layout";
import { GRAPH_ENDS, inPort, outPort } from "../logic/graph";
import { wirePath } from "../logic/wires";
import { DEMO_NODES, DEMO_REGIONS, DEMO_WIRES } from "./demo/demo.grade";
import { NodeBox } from "./NodeBox";
import { NODE_MENU } from "./node.menu";
import { useTintView } from "./view.hook";
import { useTintSet } from "./view.set.hook";

const WIRE_COLORS = {
  picture: "var(--subtle-foreground)",
  r: "#e0545a",
  g: "#4fbf6a",
  b: "#4d8fe0",
} as const;

const byId = new Map(DEMO_NODES.map((node) => [node.id, node]));

function end(id: string, side: "from" | "to"): [number, number] {
  if (id === "source") return [...GRAPH_ENDS.source];
  if (id === "out") return [...GRAPH_ENDS.out];
  const node = byId.get(id);
  if (!node) return [0, 0];
  return side === "from" ? outPort(node) : inPort(node);
}

const items: readonly MenuItem[] = NODE_MENU;

/** Leader Seal: the same grade as nodes and wires, with the groups Baby Seal knows boxed. */
export function NodeGraph() {
  const selected = useTintView((v) => v.selected);
  const set = useTintSet();
  const { width, height } = TINT_LAYOUT.graph;
  return (
    <ContextMenu items={items}>
      <div className="relative min-h-0 flex-1 overflow-hidden bg-background bg-[radial-gradient(circle,var(--border)_1px,transparent_1.3px)] bg-[length:22px_22px]">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="xMidYMid meet"
          className="absolute inset-0 size-full"
        >
          {DEMO_REGIONS.map((r) => (
            <g key={r.label}>
              <rect
                x={r.x}
                y={r.y}
                width={r.width}
                height={r.height}
                rx={6}
                fill="var(--primary-soft)"
                fillOpacity={0.15}
                stroke="var(--border-strong)"
                strokeDasharray="5 4"
              />
              <text
                x={r.x + 10}
                y={r.y + 16}
                className="fill-subtle-foreground font-hand text-xs font-bold"
              >
                {r.label}
              </text>
            </g>
          ))}
          {DEMO_WIRES.map((w) => (
            <path
              key={`${w.from}-${w.to}`}
              d={wirePath(end(w.from, "from"), end(w.to, "to"))}
              fill="none"
              stroke={WIRE_COLORS[w.kind]}
              strokeWidth={1.8}
            />
          ))}
          {(["source", "out"] as const).map((id) => (
            <g key={id}>
              <circle
                cx={GRAPH_ENDS[id][0]}
                cy={GRAPH_ENDS[id][1]}
                r={7}
                fill="var(--surface)"
                stroke="var(--primary)"
                strokeWidth={2}
              />
              <text
                x={GRAPH_ENDS[id][0] - (id === "source" ? 16 : 10)}
                y={GRAPH_ENDS[id][1] + 24}
                className="fill-subtle-foreground font-mono text-xs"
              >
                {id === "source" ? "Source" : "Out"}
              </text>
            </g>
          ))}
          {DEMO_NODES.map((node) => (
            <NodeBox
              key={node.id}
              node={node}
              selected={selected !== null && selected === node.layer}
              onSelect={() => set({ selected: node.layer ?? null })}
            />
          ))}
        </svg>
        <p className="pointer-events-none absolute bottom-2 left-2.5 font-mono text-xs text-subtle-foreground">
          Right-click to add a node · same grade as Baby Seal
        </p>
      </div>
    </ContextMenu>
  );
}

import { Scan } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { useKernel } from "@/core";
import { gradeOf, type ClipGrade, type ClipId, type NodeRef } from "@/modules/project";
import { ContextMenu, IconButton, type MenuPoint } from "@/ui";
import { fitView, graphEnds, placeAll, refPoint } from "../logic/graph";
import { groupPick } from "../logic/layers";
import { regionsOf } from "../logic/regions";
import { emptyGrade, numberOf, toStack } from "../logic/stack";
import { dropTarget, wireEntry } from "../logic/wiring";
import { graphWires, wirePath } from "../logic/wires";
import { selectNode } from "../tint.view.commands";
import { useCurrentEntry } from "./current.hook";
import { useGraphActions } from "./graph.actions.hook";
import { useGraphCamera } from "./graph.camera.hook";
import { NodeBox } from "./NodeBox";
import { startGraphDrag } from "./node.drag.gesture";
import { nodeMenu } from "./node.menu";
import { useNodeThumbs } from "./thumbs.hook";
import { useTintView } from "./view.hook";
import { startWireDrag } from "./wire.gesture";

/** Data colors of the channel wires. */
const WIRE_COLORS = {
  picture: "var(--subtle-foreground)",
  r: "#e0545a",
  g: "#4fbf6a",
  b: "#4d8fe0",
  key: "#4d8fe0",
} as const;

/** Leader Seal: the current clip's grade as nodes and wires, with the groups Baby Seal knows boxed. */
export function NodeGraph() {
  const entry = useCurrentEntry();
  if (!entry) {
    return (
      <div className="px-3 py-4 text-sm text-muted-foreground">
        Pick a clip with a picture to grade it.
      </div>
    );
  }
  return <Graph key={entry.clip.id} clipId={entry.clip.id} saved={gradeOf(entry.clip)} />;
}

function Graph({ clipId, saved }: { clipId: ClipId; saved: ClipGrade | null }) {
  const { bus } = useKernel();
  const grade = useMemo(() => saved ?? emptyGrade(), [saved]);
  const placed = useMemo(() => placeAll(grade), [grade]);
  const wires = useMemo(() => graphWires(grade, placed), [grade, placed]);
  const stack = useMemo(() => toStack(grade), [grade]);
  const regions = useMemo(() => regionsOf(stack, grade, placed), [stack, grade, placed]);
  const numbers = useMemo(() => numberOf(grade), [grade]);
  const ends = useMemo(() => graphEnds(placed), [placed]);
  const corrections = useMemo(
    () => Object.keys(grade.nodes).filter((id) => grade.nodes[id]?.kind === "correct"),
    [grade],
  );
  const thumbs = useNodeThumbs(clipId, saved, corrections);
  const selected = useTintView((v) => v.selected);
  const actions = useGraphActions(clipId, grade, placed);
  const wrap = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const line = useRef<SVGPathElement>(null);
  // The graph opens on the whole grade; Fit goes back to it.
  const [home] = useState(() => fitView(placed));
  const camera = useGraphCamera(wrap, svg, home);

  /** Shows node `id` moved by `dx, dy`, with its wires, straight on the DOM. */
  const paint = (id: string, dx: number, dy: number) => {
    const el = svg.current;
    if (!el) return;
    el.querySelector(`[data-node-id="${id}"]`)?.setAttribute("transform", `translate(${dx} ${dy})`);
    wires.forEach((w, i) => {
      if (w.from !== id && w.to !== id) return;
      const a: [number, number] = w.from === id ? [w.a[0] + dx, w.a[1] + dy] : [...w.a];
      const b: [number, number] = w.to === id ? [w.b[0] + dx, w.b[1] + dy] : [...w.b];
      el.querySelector(`[data-wire="${i}"]`)?.setAttribute("d", wirePath(a, b));
    });
  };

  const pressNode = (event: React.PointerEvent, id: string) => {
    if (event.button !== 0 || !svg.current) return;
    void bus.run(selectNode, { nodeId: id });
    const at = placed[id]!;
    startGraphDrag({
      event: event.nativeEvent,
      svg: svg.current,
      onMove: ({ dx, dy }) => paint(id, dx, dy),
      async onEnd(end) {
        if (end) await actions.place({ [id]: { x: at.x + end.dx, y: at.y + end.dy } });
        // After the render of the new place, or at once when nothing moved or it was refused.
        requestAnimationFrame(() => paint(id, 0, 0));
      },
    });
  };

  const pressPort = (event: React.PointerEvent, from: NodeRef) => {
    if (event.button !== 0 || !svg.current || !line.current) return;
    startWireDrag({
      event: event.nativeEvent,
      svg: svg.current,
      line: line.current,
      from: refPoint(placed, ends, from),
      onDrop(at) {
        const drop = at && dropTarget(grade, placed, at);
        if (drop) void actions.wire(wireEntry(grade, drop, from));
      },
    });
  };

  const picks = useMemo(
    () => ({
      parallel: groupPick(stack, selected, "parallel"),
      layer: groupPick(stack, selected, "layer"),
      channels: groupPick(stack, selected, "channels"),
    }),
    [stack, selected],
  );
  const menu = useCallback(
    ({ clientX, clientY }: MenuPoint) => {
      const ctm = svg.current?.getScreenCTM();
      const point = svg.current?.createSVGPoint();
      if (!ctm || !point) return nodeMenu(actions, picks, [0, 0]);
      point.x = clientX;
      point.y = clientY;
      const at = point.matrixTransform(ctm.inverse());
      return nodeMenu(actions, picks, [at.x, at.y]);
    },
    [actions, picks],
  );

  return (
    <ContextMenu items={menu}>
      <div
        ref={wrap}
        className="relative min-h-0 flex-1 cursor-grab touch-none overflow-hidden bg-background bg-[radial-gradient(circle,var(--border)_1px,transparent_1.3px)]"
      >
        <svg ref={svg} preserveAspectRatio="xMidYMid meet" className="absolute inset-0 size-full">
          {regions.map((r) => (
            <g key={r.id}>
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
          <path
            ref={line}
            display="none"
            fill="none"
            stroke="var(--mark)"
            strokeWidth={1.8}
            pointerEvents="none"
          />
          {(["source", "out"] as const).map((id) => (
            <g key={id} data-node>
              <circle
                cx={ends[id][0]}
                cy={ends[id][1]}
                r={7}
                fill="var(--surface)"
                stroke="var(--primary)"
                strokeWidth={2}
                className={id === "source" ? "cursor-crosshair" : undefined}
                onPointerDown={
                  id === "source" ? (e) => pressPort(e, { node: "source" }) : undefined
                }
              />
              <text
                x={ends[id][0] - (id === "source" ? 16 : 10)}
                y={ends[id][1] + 24}
                className="fill-subtle-foreground font-mono text-xs"
              >
                {id === "source" ? "Source" : "Out"}
              </text>
            </g>
          ))}
          {Object.entries(grade.nodes).map(([id, node]) => (
            <NodeBox
              key={id}
              id={id}
              node={node}
              at={placed[id]!}
              no={numbers[id]}
              thumb={thumbs[id]}
              selected={selected === id}
              onPress={pressNode}
              onPort={pressPort}
              onRemove={actions.remove}
            />
          ))}
        </svg>
        <p className="pointer-events-none absolute bottom-2 left-2.5 rounded-xs bg-background/85 px-1.5 py-0.5 font-mono text-xs text-subtle-foreground">
          Drag to move · drag from a port to wire · Ctrl+wheel to zoom · double-click to fit ·
          right-click to add
        </p>
        <IconButton
          label="Fit the whole graph in view (double-click empty space)"
          onClick={() => camera.current?.fit()}
          className="absolute right-2 bottom-2"
        >
          <Scan />
        </IconButton>
      </div>
    </ContextMenu>
  );
}

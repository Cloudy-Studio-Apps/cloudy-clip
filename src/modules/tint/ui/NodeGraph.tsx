import { Scan } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useKernel } from "@/core";
import type { NodeRef } from "@/modules/project";
import { ContextMenu, IconButton, type MenuPoint } from "@/ui";
import { fitView, graphEnds, placeAll, refPoint } from "../logic/graph";
import { groupPick } from "../logic/layers";
import { regionsOf } from "../logic/regions";
import { emptyGrade, numberOf, toStack } from "../logic/stack";
import { dropTarget, unwireEntry, wireEntry } from "../logic/wiring";
import { graphWires, wirePath } from "../logic/wires";
import { selectNode } from "../tint.view.commands";
import { useGraphActions } from "./graph.actions.hook";
import { useGraphCamera } from "./graph.camera.hook";
import { NodeBox } from "./NodeBox";
import { NoSubject } from "./NoSubject";
import { startGraphDrag } from "./node.drag.gesture";
import { nodeMenu } from "./node.menu";
import { useGradeSubject } from "./subject.hook";
import { useNodeThumbs } from "./thumbs.hook";
import type { GradeSubject } from "./ui.types";
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

/**
 * Leader Seal: the grade of the current level (the clip's, its shot group's or the whole
 * timeline's) as nodes and wires, with the groups Baby Seal knows boxed.
 */
export function NodeGraph() {
  const subject = useGradeSubject();
  if (!subject) return <NoSubject />;
  return <Graph key={subject.id} subject={subject} />;
}

function Graph({ subject }: { subject: GradeSubject }) {
  const saved = subject.grade;
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
  const thumbs = useNodeThumbs(subject, saved, corrections);
  const selected = useTintView((v) => v.selected);
  const actions = useGraphActions(subject.target, grade, placed);
  const wrap = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const line = useRef<SVGPathElement>(null);
  // The graph opens on the whole grade; Fit goes back to it.
  const [home] = useState(() => fitView(placed));
  const camera = useGraphCamera(wrap, svg, home);
  // The wires as last drawn, for a drag that ends after the grade changed.
  const latest = useRef(wires);
  useEffect(() => {
    latest.current = wires;
  }, [wires]);
  // The wire a right-click landed on, if any.
  const hit = useRef<number | null>(null);

  /** Shows node `id` moved by `dx, dy`, with its wires, straight on the DOM. */
  const paint = (id: string, dx: number, dy: number) => {
    const el = svg.current;
    if (!el) return;
    el.querySelector(`[data-node-id="${id}"]`)?.setAttribute("transform", `translate(${dx} ${dy})`);
    latest.current.forEach((w, i) => {
      if (w.from !== id && w.to !== id) return;
      const a: [number, number] = w.from === id ? [w.a[0] + dx, w.a[1] + dy] : [...w.a];
      const b: [number, number] = w.to === id ? [w.b[0] + dx, w.b[1] + dy] : [...w.b];
      el.querySelectorAll(`[data-wire="${i}"]`).forEach((p) => p.setAttribute("d", wirePath(a, b)));
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
        const placedOk =
          end !== null && (await actions.place({ [id]: { x: at.x + end.dx, y: at.y + end.dy } }));
        if (!placedOk) return paint(id, 0, 0);
        // Placed: React draws the new place and its wires; only the move offset goes.
        requestAnimationFrame(() =>
          svg.current?.querySelector(`[data-node-id="${id}"]`)?.removeAttribute("transform"),
        );
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
        const drop = at && dropTarget(grade, placed, at, from.node);
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
      const wire = hit.current === null ? undefined : wires[hit.current];
      const entry = wire && unwireEntry(grade, wire);
      const remove = entry ? () => void actions.wire(entry) : undefined;
      if (!ctm || !point) return nodeMenu(actions, picks, [0, 0], remove);
      point.x = clientX;
      point.y = clientY;
      const at = point.matrixTransform(ctm.inverse());
      return nodeMenu(actions, picks, [at.x, at.y], remove);
    },
    [actions, picks, grade, wires],
  );

  return (
    <ContextMenu items={menu}>
      <div
        ref={wrap}
        onContextMenuCapture={() => (hit.current = null)}
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
          {wires.map((w, i) => (
            <path
              key={`hit-${w.from}-${w.to}-${i}`}
              data-wire={i}
              d={wirePath(w.a, w.b)}
              fill="none"
              stroke="transparent"
              strokeWidth={12}
              pointerEvents="stroke"
              onContextMenu={() => (hit.current = i)}
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

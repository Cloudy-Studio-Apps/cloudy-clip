import type { ClipGrade, NodeRef } from "@/modules/project";
import { gradeKeys } from "@/modules/project";
import type {
  GradeGraph,
  KeyCluster,
  SealedRegion,
  StackItem,
  StackPair,
  StackParse,
  StackSink,
} from "../tint.types";
import { gradeGraph, postDominators, reach } from "./order";
import { pairOf } from "./shape";

/**
 * Keys Baby Seal can't show as "Uses the pick of": a key join, a pick off the picture path, or a
 * pick from a correction that isn't above the one using it (a sibling branch). Each is a cluster
 * of on-path corrections that must stay in one sealed card.
 */
function keyClusters(graph: GradeGraph): KeyCluster[] {
  const clusters: KeyCluster[] = [];
  for (const id of graph.onPath) {
    const node = graph.nodes[id]!;
    const from = node.kind === "correct" ? node.limit?.from : undefined;
    if (from === undefined) continue;
    if (graph.nodes[from]?.kind === "correct" && graph.onPath.has(from)) {
      const below = reach(from, (at) => graph.succ.get(at) ?? [], graph.onPath);
      if (below.has(id)) continue;
    }
    const cluster: KeyCluster = { members: new Set([id]), extras: new Set() };
    const stack = [from];
    for (let key = stack.pop(); key !== undefined; key = stack.pop()) {
      if (cluster.members.has(key) || cluster.extras.has(key) || !graph.nodes[key]) continue;
      if (graph.onPath.has(key)) cluster.members.add(key);
      else {
        cluster.extras.add(key);
        stack.push(...gradeKeys(graph.nodes[key]!));
      }
    }
    clusters.push(cluster);
  }
  return clusters;
}

/** The steps of a list from its entry to its exit, along the immediate post-dominators. */
function pairsOf(graph: GradeGraph, within: ReadonlySet<string>, from: NodeRef, exit: string) {
  const ipdom = postDominators(graph, within, exit);
  const pairs: StackPair[] = [];
  for (let entry = from; entry.node !== exit; entry = { node: pairs[pairs.length - 1]!.exit }) {
    const next = ipdom(entry.node);
    const after = next === undefined ? undefined : ipdom(next);
    if (next === undefined) pairs.push({ ...pairOf(graph, within, entry, exit), shape: null });
    else if (graph.nodes[next]?.kind !== "split" || next === exit) {
      pairs.push(pairOf(graph, within, entry, next));
    } else if (after === undefined) {
      pairs.push({ ...pairOf(graph, within, entry, exit), shape: null });
    } else pairs.push(pairOf(graph, within, entry, after, next));
  }
  return pairs;
}

/** Runs of steps to seal, merged where they overlap; clusters inside one group are handed down. */
function spansOf(pairs: StackPair[], clusters: KeyCluster[], down: Map<number, KeyCluster[]>[]) {
  const at = new Map<string, number>();
  pairs.forEach((pair, i) => pair.owned.forEach((id) => at.set(id, i)));
  const spans: [number, number][] = [];
  pairs.forEach((pair, i) => pair.shape === null && spans.push([i, i]));
  for (const cluster of clusters) {
    const found = [...cluster.members].map((id) => at.get(id) ?? 0);
    const first = Math.min(...found);
    const last = Math.max(...found);
    const shape = pairs[first]?.shape;
    if (first === last && shape?.type === "group") {
      const branch = shape.branches.findIndex((b) =>
        [...cluster.members].every((id) => b.within.has(id) && id !== b.entry.node),
      );
      if (branch >= 0) {
        const into = down[first]!;
        into.set(branch, [...(into.get(branch) ?? []), cluster]);
        continue;
      }
    }
    spans.push([first, last]);
  }
  spans.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const span of spans) {
    const last = merged[merged.length - 1];
    if (last && span[0] <= last[1]) last[1] = Math.max(last[1], span[1]);
    else merged.push([...span]);
  }
  return merged;
}

/** The ref a list's sink reads now, channel included. */
function sinkRef(graph: GradeGraph, sink: StackSink): NodeRef | undefined {
  if (sink.kind === "out") return graph.out;
  const join = graph.nodes[sink.node];
  if (sink.kind === "input") {
    return join?.kind === "parallel" || join?.kind === "layer"
      ? join.inputs[sink.index]
      : undefined;
  }
  return join?.kind === "join" ? join[sink.channel] : undefined;
}

/** Reads one list (the top or a branch) into items, recording its wiring in `acc`. */
function readList(
  graph: GradeGraph,
  list: { within: ReadonlySet<string>; entry: NodeRef; exit: string; sink: StackSink },
  clusters: KeyCluster[],
  acc: StackParse,
): StackItem[] {
  const pairs = pairsOf(graph, list.within, list.entry, list.exit);
  const down = pairs.map(() => new Map<number, KeyCluster[]>());
  const spans = spansOf(pairs, clusters, down);
  const entries: StackParse["lists"][number]["entries"] = [];
  acc.lists.push({ entry: list.entry, sink: list.sink, entries });
  const items: StackItem[] = [];
  for (let i = 0; i < pairs.length; i++) {
    const pair = pairs[i]!;
    const span = spans.find(([first]) => first === i);
    let item: StackItem;
    let nodes = [...pair.owned];
    let exit = pair.exit;
    if (span) {
      nodes = pairs.slice(span[0], span[1] + 1).flatMap((step) => [...step.owned]);
      const inside = new Set(nodes);
      const extras = clusters
        .filter((cluster) => [...cluster.members].every((id) => inside.has(id)))
        .flatMap((cluster) => [...cluster.extras]);
      const all = [...new Set([...nodes, ...extras])];
      all.sort((a, b) => graph.index.get(a)! - graph.index.get(b)!);
      exit = pairs[span[1]]!.exit;
      item = { type: "sealed", id: `sealed:${all[0]}`, nodes: all };
      acc.sealed.push({ entry: pair.entry, exit, nodes: all });
      i = span[1];
    } else if (pair.shape?.type === "group") {
      const branches = pair.shape.branches.map((branch, b) =>
        readList(graph, branch, down[i]!.get(b) ?? [], acc),
      );
      item = { type: "group", id: pair.exit, kind: pair.shape.kind, branches };
    } else item = { type: "layer", id: pair.exit };
    // The last item's exit is what the sink reads, so a split's channel stays.
    const read = exit === list.exit ? sinkRef(graph, list.sink) : undefined;
    const exitRef = read?.node === exit ? { ...read } : { node: exit };
    entries.push({ item, entry: pair.entry, exit: exitRef, nodes });
    items.push(item);
  }
  return items;
}

/** A grade read as a stack: items top to bottom, every list's wiring and the sealed regions. */
export function parseStack(grade: ClipGrade | null): StackParse {
  const acc: StackParse = { items: [], lists: [], sealed: [] };
  if (!grade) return acc;
  const graph = gradeGraph(grade);
  const within = new Set(["source", ...graph.onPath]);
  const sink: StackSink = { kind: "out" };
  const top = { within, entry: { node: "source" }, exit: grade.out.node, sink };
  acc.items = readList(graph, top, keyClusters(graph), acc);
  return acc;
}

/**
 * The parts of a grade Baby Seal shows as sealed cards: the smallest region between a node and its
 * immediate post-dominator that isn't a chain or a recognized group, grown to hold every key that
 * crosses its edge. Each with the picture in, the node out and every node inside.
 */
export function sealedRegions(grade: ClipGrade): SealedRegion[] {
  return parseStack(grade).sealed;
}

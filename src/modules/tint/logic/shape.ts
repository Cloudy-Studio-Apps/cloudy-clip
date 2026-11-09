import type { GradeNode, GradeNodeId, NodeRef } from "@/modules/project";
import { gradeInputs } from "@/modules/project";
import type { GradeGraph, StackBranch, StackPair, StackSink } from "../tint.types";
import { inputIds, reach, sameRef } from "./order";
import { CHANNELS } from "./rewire";

/** The nodes strictly between `from` and `to` inside `within`. */
function between(
  graph: GradeGraph,
  within: ReadonlySet<string>,
  from: string,
  to: string,
): Set<string> {
  const ahead = reach(from, (id) => graph.succ.get(id) ?? [], within);
  const behind = reach(to, (id) => inputIds(graph, id), within);
  const found = new Set([...ahead].filter((id) => behind.has(id)));
  found.delete(from);
  found.delete(to);
  return found;
}

/**
 * The branch ending at `ref` inside `inner`: closed (it reads only `entry` from outside, and only
 * `ref.node` leaves it, once, into `join`), or null.
 */
function branchOf(
  graph: GradeGraph,
  inner: ReadonlySet<string>,
  entry: NodeRef,
  ref: NodeRef,
  join: GradeNode,
  joinId: GradeNodeId,
): Set<string> | null {
  if (ref.channel || !inner.has(ref.node)) return null;
  const nodes = reach(ref.node, (id) => inputIds(graph, id), inner);
  for (const id of nodes) {
    for (const input of gradeInputs(graph.nodes[id]!)) {
      if (!nodes.has(input.node) && !sameRef(input, entry)) return null;
    }
    for (const to of graph.succ.get(id) ?? []) {
      if (!nodes.has(to) && !(to === joinId && id === ref.node)) return null;
    }
  }
  const leaving = gradeInputs(join).filter((input) => nodes.has(input.node));
  return leaving.length === 1 ? nodes : null;
}

/** Branches of `join`, one per end (the picture each starts from and ends at), covering exactly `inner`; or null. */
function branchesOf(
  graph: GradeGraph,
  inner: ReadonlySet<string>,
  joinId: GradeNodeId,
  ends: { entry: NodeRef; ref: NodeRef; sink: StackSink }[],
): StackBranch[] | null {
  const join = graph.nodes[joinId]!;
  const seen = new Set<string>();
  const branches: StackBranch[] = [];
  for (const { entry, ref, sink } of ends) {
    if (ref.node === entry.node) {
      if (!sameRef(ref, entry)) return null;
      branches.push({ within: new Set([entry.node]), entry, exit: entry.node, sink });
      continue;
    }
    const nodes = branchOf(graph, inner, entry, ref, join, joinId);
    if (!nodes || [...nodes].some((id) => seen.has(id))) return null;
    for (const id of nodes) seen.add(id);
    branches.push({ within: new Set([entry.node, ...nodes]), entry, exit: ref.node, sink });
  }
  return seen.size === inner.size ? branches : null;
}

/**
 * The step from `cur` (read as `entry`) to `exit`, and what Baby Seal can show of it: a layer, a
 * side-by-side or stacked group, a per-channel group (`split` is the split between), or nothing.
 */
export function pairOf(
  graph: GradeGraph,
  within: ReadonlySet<string>,
  entry: NodeRef,
  exit: string,
  split?: string,
): StackPair {
  const owned = between(graph, within, entry.node, exit);
  owned.add(exit);
  const pair: StackPair = { entry, exit, owned, shape: null };
  const node = graph.nodes[exit]!;
  if (split !== undefined) {
    const splitNode = graph.nodes[split]!;
    if (node.kind !== "join" || splitNode.kind !== "split" || !sameRef(splitNode.input, entry)) {
      return pair;
    }
    const inner = new Set(owned);
    inner.delete(exit);
    inner.delete(split);
    const ends = CHANNELS.map((channel) => ({
      entry: { node: split, channel },
      ref: node[channel],
      sink: { kind: "channel", node: exit, channel } as const,
    }));
    const branches = branchesOf(graph, inner, exit, ends);
    if (branches) pair.shape = { type: "group", kind: "channels", branches };
    return pair;
  }
  if (node.kind === "correct" && owned.size === 1 && sameRef(node.input, entry)) {
    pair.shape = { type: "layer" };
  } else if (node.kind === "parallel" || node.kind === "layer") {
    const inner = new Set(owned);
    inner.delete(exit);
    const ends = node.inputs.map((ref, index) => ({
      entry,
      ref,
      sink: { kind: "input", node: exit, index } as const,
    }));
    const branches = branchesOf(graph, inner, exit, ends);
    if (branches) pair.shape = { type: "group", kind: node.kind, branches };
  }
  return pair;
}

import type { ClipGrade, GradeNodeId, NodeRef } from "@/modules/project";
import { gradeInputs, gradeKeys } from "@/modules/project";
import type { GradeGraph } from "../tint.types";

/**
 * Every node in an order that evaluates the grade: each after the pictures and keys it reads.
 * Depth first from `out` (inputs in order, then keys), so a chain reads top to bottom; nodes `out`
 * doesn't need come last.
 */
export function topoOrder(grade: ClipGrade): GradeNodeId[] {
  const order: GradeNodeId[] = [];
  const seen = new Set<string>();
  const visit = (id: string): void => {
    const node = grade.nodes[id];
    if (!node || seen.has(id)) return;
    seen.add(id);
    for (const ref of gradeInputs(node)) visit(ref.node);
    for (const from of gradeKeys(node)) visit(from);
    order.push(id);
  };
  visit(grade.out.node);
  for (const id of Object.keys(grade.nodes)) visit(id);
  return order;
}

/** Two refs to the same picture. */
export function sameRef(a: NodeRef, b: NodeRef): boolean {
  return a.node === b.node && a.channel === b.channel;
}

/** Everything reachable from `start` by `next`, inside `within`, `start` included. */
export function reach(
  start: string,
  next: (id: string) => Iterable<string>,
  within: ReadonlySet<string>,
): Set<string> {
  const found = new Set<string>([start]);
  const stack = [start];
  for (let id = stack.pop(); id !== undefined; id = stack.pop()) {
    for (const to of next(id)) {
      if (within.has(to) && !found.has(to)) {
        found.add(to);
        stack.push(to);
      }
    }
  }
  return found;
}

/** The picture inputs of a vertex, by id (none for the source). */
export function inputIds(graph: GradeGraph, id: string): string[] {
  const node = graph.nodes[id];
  return node ? gradeInputs(node).map((ref) => ref.node) : [];
}

/** A grade's graph prepared for reading as a stack. */
export function gradeGraph(grade: ClipGrade): GradeGraph {
  const order = topoOrder(grade);
  const index = new Map<string, number>([["source", -1]]);
  order.forEach((id, i) => index.set(id, i));
  const all = new Set<string>(["source", ...order]);
  const consumers = new Map<string, Set<string>>();
  for (const id of order) {
    for (const ref of gradeInputs(grade.nodes[id]!)) {
      const set = consumers.get(ref.node) ?? new Set<string>();
      set.add(id);
      consumers.set(ref.node, set);
    }
  }
  const draft: GradeGraph = { nodes: grade.nodes, index, onPath: new Set(), succ: new Map() };
  const fromSource = reach("source", (id) => consumers.get(id) ?? [], all);
  const toOut = reach(grade.out.node, (id) => inputIds(draft, id), all);
  for (const id of order) if (fromSource.has(id) && toOut.has(id)) draft.onPath.add(id);
  for (const id of ["source", ...draft.onPath]) {
    const next = [...(consumers.get(id) ?? [])].filter((to) => draft.onPath.has(to));
    draft.succ.set(id, new Set(next));
  }
  return draft;
}

/**
 * Immediate post-dominators inside `within`, toward `exit`: the first vertex every picture path
 * from a vertex passes through. Undefined for `exit` and for a vertex that doesn't reach it.
 */
export function postDominators(
  graph: GradeGraph,
  within: ReadonlySet<string>,
  exit: string,
): (id: string) => string | undefined {
  const memo = new Map<string, Set<string> | null>();
  const pdom = (id: string): Set<string> | null => {
    const known = memo.get(id);
    if (known !== undefined) return known;
    let found: Set<string> | null = new Set([exit]);
    if (id !== exit) {
      const next = [...(graph.succ.get(id) ?? [])].filter((to) => within.has(to));
      const theirs = next.map(pdom);
      if (next.length === 0 || theirs.some((set) => set === null)) found = null;
      else {
        const [head, ...rest] = theirs as Set<string>[];
        found = new Set([...head!].filter((v) => rest.every((set) => set.has(v))));
        found.add(id);
      }
    }
    memo.set(id, found);
    return found;
  };
  return (id) => {
    const set = pdom(id);
    if (!set) return undefined;
    let best: string | undefined;
    for (const v of set) {
      if (v === id) continue;
      if (best === undefined || graph.index.get(v)! < graph.index.get(best)!) best = v;
    }
    return best;
  };
}

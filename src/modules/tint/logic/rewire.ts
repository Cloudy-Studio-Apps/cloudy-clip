import type { ClipGrade, GradeNode, GradeNodeId, NodeRef } from "@/modules/project";
import type { StackEntry, StackList, StackParse, StackPosition, StackSink } from "../tint.types";
import { sameRef } from "./order";

/** The channels of a per-channel group, in branch order. */
export const CHANNELS = ["r", "g", "b"] as const;

/** Changes every picture ref a node reads through `swap` (in place, on a draft). */
export function swapRefs(node: GradeNode, swap: (ref: NodeRef) => NodeRef): void {
  switch (node.kind) {
    case "correct":
    case "split":
      node.input = swap(node.input);
      break;
    case "parallel":
    case "layer":
      node.inputs = node.inputs.map(swap);
      break;
    case "join":
      node.r = swap(node.r);
      node.g = swap(node.g);
      node.b = swap(node.b);
      break;
    case "keyJoin":
      break;
  }
}

/** Points the given nodes' reads of `from` at `to` (in place, on a draft). */
export function rewire(
  grade: ClipGrade,
  ids: Iterable<GradeNodeId>,
  from: NodeRef,
  to: NodeRef,
): void {
  for (const id of ids) {
    const node = grade.nodes[id];
    if (node) swapRefs(node, (ref) => (sameRef(ref, from) ? { ...to } : ref));
  }
}

/** Points a list's sink at `to` (in place, on a draft). */
function setSink(grade: ClipGrade, sink: StackSink, to: NodeRef): void {
  if (sink.kind === "out") {
    grade.out = { ...to };
    return;
  }
  const join = grade.nodes[sink.node];
  if (sink.kind === "input" && (join?.kind === "parallel" || join?.kind === "layer")) {
    join.inputs[sink.index] = { ...to };
  } else if (sink.kind === "channel" && join?.kind === "join") join[sink.channel] = { ...to };
}

/** Points what reads slot `k` of a list (its item there, or its sink past the end) from `from` to `to`. */
export function rewireAt(
  grade: ClipGrade,
  list: StackList,
  k: number,
  from: NodeRef,
  to: NodeRef,
): void {
  const entry = list.entries[k];
  if (entry) rewire(grade, entry.nodes, from, to);
  else setSink(grade, list.sink, to);
}

/** The picture slot `k` of a list reads: its entry, or the exit of the item above. */
export function upstream(list: StackList, k: number): NodeRef {
  return k === 0 ? list.entry : list.entries[k - 1]!.exit;
}

/**
 * A whole split read with no channel: a picture between items that may be read through several
 * channels at once, so no layer can be put on it without changing what is read.
 */
export function bareSplit(grade: ClipGrade, ref: NodeRef): boolean {
  return ref.channel === undefined && grade.nodes[ref.node]?.kind === "split";
}

/** Where an item (layer, group or sealed card, by id) sits. */
export function locate(
  parse: StackParse,
  id: string,
): { list: StackList; index: number; entry: StackEntry } | null {
  for (const list of parse.lists) {
    const index = list.entries.findIndex((entry) => entry.item.id === id);
    if (index >= 0) return { list, index, entry: list.entries[index]! };
  }
  return null;
}

/** Whether a list is branch `index` of `group`. */
function isBranch(list: StackList, branch: { group: GradeNodeId; index: number }): boolean {
  const { sink } = list;
  if (sink.kind === "input") return sink.node === branch.group && sink.index === branch.index;
  if (sink.kind === "channel") {
    return sink.node === branch.group && CHANNELS[branch.index] === sink.channel;
  }
  return false;
}

/**
 * A position as a list and a slot in it, or null when it names nothing in the stack or its
 * picture is a whole split (see {@link bareSplit}).
 */
export function slotOf(
  grade: ClipGrade,
  parse: StackParse,
  at: StackPosition,
): { list: StackList; k: number } | null {
  const id = at.before ?? at.after;
  let slot: { list: StackList; k: number } | null;
  if (id !== undefined) {
    const found = locate(parse, id);
    if (!found || (at.branch && !isBranch(found.list, at.branch))) return null;
    slot = { list: found.list, k: at.before !== undefined ? found.index : found.index + 1 };
  } else {
    const branch = at.branch;
    const list = branch ? parse.lists.find((l) => isBranch(l, branch)) : parse.lists[0];
    slot = list ? { list, k: list.entries.length } : null;
  }
  return slot && !bareSplit(grade, upstream(slot.list, slot.k)) ? slot : null;
}

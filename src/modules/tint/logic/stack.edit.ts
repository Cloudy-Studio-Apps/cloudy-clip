import type { ClipGrade, Correction, GradeNodeId, NodeRef } from "@/modules/project";
import { validateGrade } from "@/modules/project";
import type { StackPosition } from "../tint.types";
import { sameRef } from "./order";
import { locate, rewire, rewireAt, slotOf, swapRefs, upstream } from "./rewire";
import { parseStack } from "./seal";

/**
 * A new grade with `node` added as layer `id` at a place in the stack; its `input` is set from the
 * place. Throws when the place names nothing in the stack (a node inside a sealed card included)
 * or `id` is taken.
 */
export function insertLayer(
  grade: ClipGrade,
  at: StackPosition,
  id: GradeNodeId,
  node: Correction,
): ClipGrade {
  const slot = slotOf(parseStack(grade), at);
  if (!slot) throw new Error(`no place in the stack at ${JSON.stringify(at)}`);
  if (grade.nodes[id]) throw new Error(`node "${id}" already exists`);
  const next = structuredClone(grade);
  const input = upstream(slot.list, slot.k);
  rewireAt(next, slot.list, slot.k, input, { node: id });
  next.nodes[id] = { ...structuredClone(node), input: { ...input } };
  return next;
}

/**
 * A new grade with an item (a layer, a group or a sealed card) moved to another place: what read
 * it reads its old input, and it sits between the new place's input and what read that. Null when
 * the item or the place is inside a sealed card (or not in the stack), when a group would move
 * into itself, or when the result is not a valid grade (a shared key read before it is made).
 */
export function moveLayer(grade: ClipGrade, id: GradeNodeId, to: StackPosition): ClipGrade | null {
  const parse = parseStack(grade);
  const from = locate(parse, id);
  const slot = slotOf(parse, to);
  if (!from || !slot) return null;
  const { list, index, entry: moved } = from;
  if (slot.list === list && (slot.k === index || slot.k === index + 1)) {
    return structuredClone(grade);
  }
  const inside = new Set(moved.nodes);
  const sink = slot.list.sink;
  if (slot.list !== list && sink.kind !== "out" && inside.has(sink.node)) return null;
  const next = structuredClone(grade);
  // Take it out: what read its exit reads its entry.
  rewireAt(next, list, index + 1, moved.exit, moved.entry);
  // Put it in: the new place's input, which was its exit when the place was just below it.
  const above = upstream(slot.list, slot.k);
  const input = sameRef(above, moved.exit) ? moved.entry : above;
  rewireAt(next, slot.list, slot.k, input, moved.exit);
  if (!sameRef(input, moved.entry)) rewire(next, moved.nodes, moved.entry, input);
  return validateGrade(next) === null ? next : null;
}

/** The picture a removed node passes on: its (first) input. */
function passedOn(grade: ClipGrade, id: GradeNodeId): NodeRef | undefined {
  const node = grade.nodes[id];
  switch (node?.kind) {
    case "correct":
    case "split":
      return node.input;
    case "parallel":
    case "layer":
      return node.inputs[0];
    case "join":
      return node.r;
    default:
      return undefined;
  }
}

/**
 * A new grade without the given nodes. Each consumer reads the removed node's input instead (a
 * join's first input; a channel of a removed split becomes the split's input), and shared keys
 * from a removed node are dropped.
 */
export function removeNodes(grade: ClipGrade, ids: readonly GradeNodeId[]): ClipGrade {
  const gone = new Set(ids.filter((id) => grade.nodes[id]));
  const resolve = (ref: NodeRef): NodeRef => {
    let found = ref;
    for (let hops = 0; gone.has(found.node) && hops <= gone.size; hops++) {
      found = passedOn(grade, found.node) ?? { node: "source" };
    }
    return found === ref ? ref : { ...found };
  };
  const next = structuredClone(grade);
  for (const id of gone) delete next.nodes[id];
  for (const node of Object.values(next.nodes)) {
    swapRefs(node, resolve);
    if (node.kind === "correct" && node.limit?.from !== undefined && gone.has(node.limit.from)) {
      delete node.limit.from;
      if (Object.keys(node.limit).length === 0) delete node.limit;
    }
    if (node.kind === "keyJoin") node.keys = node.keys.filter((key) => !gone.has(key.from));
  }
  next.out = resolve(next.out);
  return next;
}

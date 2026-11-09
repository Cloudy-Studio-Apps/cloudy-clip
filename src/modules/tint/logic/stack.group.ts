import type { ClipGrade, GradeNodeId, NodeRef } from "@/modules/project";
import { validateGrade } from "@/modules/project";
import { CHANNELS, locate, rewire, rewireAt, upstream } from "./rewire";
import { parseStack } from "./seal";

/**
 * A new grade with consecutive items of one list put in a group whose join is `joinId`: side by
 * side (`parallel`) or stacked (`layer`, every blend normal), each item its own branch from the
 * picture above; or per channel (`channels`, needs `splitId`), the items (one to three) in the
 * red, green and blue branches, the rest left empty. Null when the items aren't consecutive in
 * one list, there are too few or too many, an id is taken, or the result isn't such a group.
 */
export function groupLayers(
  grade: ClipGrade,
  ids: readonly GradeNodeId[],
  kind: "parallel" | "layer" | "channels",
  joinId: GradeNodeId,
  splitId?: GradeNodeId,
): ClipGrade | null {
  const channels = kind === "channels";
  if (channels ? ids.length > 3 || splitId === undefined : ids.length < 2) return null;
  if (ids.length === 0 || grade.nodes[joinId] || (splitId && grade.nodes[splitId])) return null;
  const parse = parseStack(grade);
  const found = ids.map((id) => locate(parse, id));
  const list = found[0]?.list;
  const indexes = found.map((where) => (where && where.list === list ? where.index : -1));
  indexes.sort((a, b) => a - b);
  const first = indexes[0]!;
  if (!list || first < 0 || indexes.some((at, i) => at !== first + i)) return null;
  const last = first + ids.length - 1;
  const entries = list.entries.slice(first, last + 1);
  const input = upstream(list, first);
  const next = structuredClone(grade);
  rewireAt(next, list, last + 1, entries[entries.length - 1]!.exit, { node: joinId });
  if (channels) {
    const split = splitId!;
    next.nodes[split] = { kind: "split", input: { ...input } };
    const [r, g, b] = CHANNELS.map((channel, i): NodeRef => {
      const entry = entries[i];
      if (!entry) return { node: split, channel };
      rewire(next, entry.nodes, entry.entry, { node: split, channel });
      return entry.exit;
    });
    next.nodes[joinId] = { kind: "join", r: r!, g: g!, b: b! };
  } else {
    const inputs = entries.map((entry) => {
      rewire(next, entry.nodes, entry.entry, input);
      return { ...entry.exit };
    });
    next.nodes[joinId] =
      kind === "parallel"
        ? { kind, inputs, on: true, opacity: 1 }
        : { kind, inputs, blends: inputs.map(() => "normal"), on: true, opacity: 1 };
  }
  if (validateGrade(next) !== null || !locate(parseStack(next), joinId)) return null;
  return next;
}

/**
 * A new grade with a group taken apart: its branches' items in a row, branch by branch, where
 * the group was; empty branches vanish, and the join (and a per-channel group's split) go.
 * Throws when `joinId` is not a group of the stack.
 */
export function ungroup(grade: ClipGrade, joinId: GradeNodeId): ClipGrade {
  const parse = parseStack(grade);
  const found = locate(parse, joinId);
  if (found?.entry.item.type !== "group") throw new Error(`"${joinId}" is not a group`);
  const branches = parse.lists.filter(
    (list) => list.sink.kind !== "out" && list.sink.node === joinId,
  );
  const next = structuredClone(grade);
  let above = found.entry.entry;
  for (const branch of branches) {
    const first = branch.entries[0];
    if (!first) continue;
    rewire(next, first.nodes, branch.entry, above);
    above = branch.entries[branch.entries.length - 1]!.exit;
  }
  rewireAt(next, found.list, found.index + 1, found.entry.exit, above);
  delete next.nodes[joinId];
  if (found.entry.item.kind === "channels" && branches[0])
    delete next.nodes[branches[0].entry.node];
  return next;
}

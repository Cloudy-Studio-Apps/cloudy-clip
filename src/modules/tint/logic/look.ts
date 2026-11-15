import { validateGrade, type ClipGrade, type GradeNodeId, type NodeRef } from "@/modules/project";
import type { LookDef } from "../tint.types";
import { swapRefs } from "./rewire";
import { emptyGrade } from "./stack";

/**
 * A look as a grade: its corrections one after another from the source, each named after the look
 * and its own name. `newId` makes node ids.
 */
export function lookGrade(look: LookDef, newId: () => GradeNodeId): ClipGrade {
  const grade = emptyGrade();
  for (const { name, values, limit } of look.corrections) {
    const id = newId();
    grade.nodes[id] = {
      kind: "correct",
      input: { ...grade.out },
      on: true,
      opacity: 1,
      name: `${look.name}: ${name}`,
      values: structuredClone(values),
      ...(limit ? { limit: structuredClone(limit) } : {}),
    };
    grade.out = { node: id };
  }
  return grade;
}

/**
 * `base` with `extra` added after everything it has: `extra`'s nodes under fresh ids, what read
 * its source reading `base`'s result, and its result the new result. Positions are dropped (they
 * would sit on top of `base`'s), and `base`'s color space is kept. Null when `extra` has no nodes
 * or the result is not a valid grade.
 */
export function appendGrade(
  base: ClipGrade | null,
  extra: ClipGrade,
  newId: () => GradeNodeId,
): ClipGrade | null {
  const ids = Object.keys(extra.nodes);
  if (ids.length === 0) return null;
  const into = base ?? emptyGrade();
  const fresh = new Map(ids.map((id) => [id, newId()]));
  const rename = (id: GradeNodeId) => fresh.get(id) ?? id;
  const read = (ref: NodeRef): NodeRef =>
    ref.node === "source" ? { ...into.out } : { ...ref, node: rename(ref.node) };
  const next = structuredClone(into);
  for (const id of ids) {
    const node = structuredClone(extra.nodes[id]!);
    swapRefs(node, read);
    delete node.pos;
    if (node.kind === "correct" && node.limit?.from !== undefined) {
      node.limit.from = rename(node.limit.from);
    }
    if (node.kind === "keyJoin") for (const key of node.keys) key.from = rename(key.from);
    next.nodes[rename(id)] = node;
  }
  next.out = read(extra.out);
  return validateGrade(next) === null ? next : null;
}

/**
 * What applying `extra` to `base` would draw, with node ids that depend only on the two grades
 * (so the same pair gives the same grade, and a thumbnail of it can be kept). Null as
 * `appendGrade`.
 */
export function previewGrade(base: ClipGrade | null, extra: ClipGrade): ClipGrade | null {
  let n = 0;
  return appendGrade(base, extra, () => `~look${n++}`);
}

import type { ClipGrade, Correction, GradeNodeId } from "@/modules/project";
import { gradeInputs, gradeKeys } from "@/modules/project";
import type { KeyProblem, SharedKey } from "../tint.types";
import { limitActive, prepareLimit } from "./color/limit";

/**
 * The key a correction mixes by, or null when it limits nothing. Its own limit's (`owner` itself)
 * or, with `limit.from`, the pick of the correction it names, followed through further `from`s
 * to the one that picks (`owner`): that one's windows, blur and clean up, inverted once more for
 * each correction along the way that inverts. A key from something else (a key join, Leader
 * Seal's), from a correction whose limit limits nothing, or a loop, is null. Never throws.
 */
export function sharedKey(grade: ClipGrade, id: GradeNodeId): SharedKey | null {
  let owner = id;
  let flip = false;
  const seen = new Set<string>();
  for (;;) {
    const node = grade.nodes[owner];
    if (node?.kind !== "correct" || seen.has(owner)) return null;
    seen.add(owner);
    const from = node.limit?.from;
    if (from === undefined) break;
    if (node.limit?.invert) flip = !flip;
    owner = from;
  }
  const params = prepareLimit((grade.nodes[owner] as Correction).limit);
  if (!params) return null;
  return { owner, params: flip ? { ...params, invert: !params.invert } : params };
}

/** Whether `id` reads `of` (through pictures or keys), or is it. */
export function dependsOn(grade: ClipGrade, id: string, of: string): boolean {
  const seen = new Set<string>();
  const stack = [id];
  for (let at = stack.pop(); at !== undefined; at = stack.pop()) {
    if (at === of) return true;
    const node = grade.nodes[at];
    if (!node || seen.has(at)) continue;
    seen.add(at);
    stack.push(...gradeInputs(node).map((ref) => ref.node), ...gradeKeys(node));
  }
  return false;
}

/**
 * What is wrong with correction `id` taking its key from `from`: `missing` (no such node),
 * `not_limited` (not a correction whose limit limits something, by its own pick or a shared one),
 * `cycle` (`from` is `id`, or reads it), or null.
 */
export function keyProblem(grade: ClipGrade, id: GradeNodeId, from: GradeNodeId): KeyProblem {
  const source = grade.nodes[from];
  if (!source) return "missing";
  if (from === id || dependsOn(grade, from, id)) return "cycle";
  if (source.kind !== "correct") return "not_limited";
  if (source.limit?.from === undefined && !limitActive(source.limit)) return "not_limited";
  return null;
}

/**
 * The corrections whose pick correction `id` can use ("Use the pick of"): those above it (it
 * reads their picture) whose limit limits something, by their own pick or a shared one, in
 * `order` (the stack's numbering).
 */
export function keyChoices(
  grade: ClipGrade,
  id: GradeNodeId,
  order: readonly GradeNodeId[],
): GradeNodeId[] {
  const node = grade.nodes[id];
  if (node?.kind !== "correct") return [];
  return order.filter(
    (from) =>
      from !== id &&
      keyProblem(grade, id, from) === null &&
      dependsOn(grade, node.input.node, from),
  );
}

import type { ClipGrade, Correction, GradeNodeId } from "@/modules/project";
import { gradeReads, keyFromAbove } from "@/modules/project";
import type { KeyProblem, LimitParams, SharedKey } from "../tint.types";
import { limitActive, prepareLimit } from "./color/limit";

/** How a key join's key is read: already finished (cleaned up and inverted per entry), so as is. */
export const JOINED_KEY: LimitParams = {
  hue: null,
  sat: [0, 1, 0],
  lum: [0, 1, 0],
  bright: null,
  radius: 0,
  clean: 0,
  invert: false,
};

/**
 * The key a correction mixes by, or null when it limits nothing. Its own limit's (`owner` itself)
 * or, with `limit.from`, the pick of the correction it names, followed through further `from`s
 * to the one that picks (`owner`): that one's windows, blur and clean up, inverted once more for
 * each correction along the way that inverts. A chain ending at a key join gives that join as
 * `owner`, read as `JOINED_KEY` (inverted when the chain inverts). A key from anything else, from a
 * correction whose limit limits nothing, or a loop, is null. Never throws.
 */
export function sharedKey(grade: ClipGrade, id: GradeNodeId): SharedKey | null {
  let owner = id;
  let flip = false;
  const seen = new Set<string>();
  for (;;) {
    const node = Object.hasOwn(grade.nodes, owner) ? grade.nodes[owner] : undefined;
    if (node?.kind === "keyJoin" && owner !== id) {
      return { owner, params: { ...JOINED_KEY, invert: flip } };
    }
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

/**
 * What is wrong with correction `id` taking its key from `from`: `missing` (no such node),
 * `not_limited` (not a key join, nor a correction whose limit limits something, by its own pick
 * or a shared one),
 * `cycle` (`from` is `id`, or reads it), `not_above` (`from` is on the picture path but not above
 * `id`: a sibling branch; project's `keyFromAbove`, the rule `validateGrade` keeps), or null.
 */
export function keyProblem(grade: ClipGrade, id: GradeNodeId, from: GradeNodeId): KeyProblem {
  const source = Object.hasOwn(grade.nodes, from) ? grade.nodes[from] : undefined;
  if (!source) return "missing";
  if (from === id || gradeReads(grade, from, id)) return "cycle";
  if (!keyFromAbove(grade, id, from)) return "not_above";
  if (source.kind === "keyJoin") return null;
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
  const node = Object.hasOwn(grade.nodes, id) ? grade.nodes[id] : undefined;
  if (node?.kind !== "correct") return [];
  // The menu offers only picks above it, not off-path ones (Leader Seal's).
  return order.filter(
    (from) => keyProblem(grade, id, from) === null && gradeReads(grade, node.input.node, from),
  );
}

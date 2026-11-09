import type { ClipGrade, Correction, GradeNodeId, NodeRef } from "@/modules/project";
import type { GradeOps, GradeWalk, LimitParams } from "../tint.types";
import { entryOf } from "./entry";
import { sharedKey } from "./keys";

/**
 * Walks a grade the one way both the passes and the CPU reference draw it, each picture and key
 * made once and only when something reads it:
 *
 * - a correction that is off, or at opacity 0, is its input; else `ops.correct` over its input,
 *   with its key (`sharedKey`: its own pick, or the pick its `limit.from` leads to, made once by
 *   `ops.key` from the input of the correction that picks, even when that one is off);
 * - a split is its input; a channel of it is `ops.channel` (gray);
 * - a side-by-side or stacked join reads its branches and `entry` (`entryOf`: the picture the
 *   branches start from); off, or at opacity 0, it is that entry;
 * - a channel join takes red, green and blue of each slot's whole picture (a channel's own gray
 *   would give the same), and is that picture when all three are one;
 * - a missing node, a key join (no picture) and a loop are the source. Never throws.
 */
export function walkGrade<P, K>(grade: ClipGrade, ops: GradeOps<P, K>): GradeWalk<P, K> {
  const pictures = new Map<string, P>();
  const keys = new Map<GradeNodeId, K>();
  const busy = new Set<string>();
  let entries: ((id: GradeNodeId) => NodeRef) | undefined;
  const entry = (id: GradeNodeId) => (entries ??= entryOf(grade))(id);

  const key = (id: GradeNodeId): { key: K; params: LimitParams } | null => {
    const shared = sharedKey(grade, id);
    if (!shared) return null;
    let found = keys.get(shared.owner);
    if (found === undefined) {
      const owner = grade.nodes[shared.owner] as Correction;
      found = ops.key(shared.params, picture(owner.input));
      keys.set(shared.owner, found);
    }
    return { key: found, params: shared.params };
  };

  const made = (id: GradeNodeId): P => {
    const node = grade.nodes[id];
    if (!node) return ops.source;
    switch (node.kind) {
      case "correct": {
        const input = picture(node.input);
        if (!node.on || node.opacity <= 0) return input;
        return ops.correct(id, node, input, key(id));
      }
      case "split":
        return picture(node.input);
      case "join": {
        const [r, g, b] = [node.r, node.g, node.b].map((ref) => picture({ node: ref.node }));
        return r === g && g === b ? r! : ops.join(r!, g!, b!);
      }
      case "parallel":
      case "layer": {
        const from = picture(entry(id));
        if (!node.on || node.opacity <= 0) return from;
        const branches = node.inputs.map(picture);
        const opacity = Math.min(node.opacity, 1);
        return node.kind === "parallel"
          ? ops.parallel(from, branches, opacity)
          : ops.layer(from, branches, node.blends, opacity);
      }
      case "keyJoin":
        return ops.source;
    }
  };

  const picture = (ref: NodeRef): P => {
    if (ref.node === "source") return ops.source;
    const vertex = ref.channel ? `${ref.node}\u0000${ref.channel}` : ref.node;
    if (pictures.has(vertex)) return pictures.get(vertex)!;
    if (busy.has(vertex)) return ops.source;
    busy.add(vertex);
    const value =
      ref.channel && grade.nodes[ref.node]?.kind === "split"
        ? ops.channel(picture({ node: ref.node }), ref.channel)
        : made(ref.node);
    busy.delete(vertex);
    pictures.set(vertex, value);
    return value;
  };

  return { picture, key };
}

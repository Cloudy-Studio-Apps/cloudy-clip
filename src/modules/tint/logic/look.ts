import {
  gradeInputs,
  renameGradeKeys,
  validateGrade,
  type ClipGrade,
  type GradeNodeId,
} from "@/modules/project";
import type { LookDef } from "../tint.types";
import { insertLayer } from "./stack.edit";
import { emptyGrade } from "./stack";

/**
 * `base` with a look's corrections added one after another at the bottom of the stack (the layer
 * insert `tint.addCorrection` uses), each named `<look>: <correction>`. Null when a place is
 * refused or the result is not a valid grade.
 */
function withLook(
  base: ClipGrade | null,
  look: LookDef,
  newId: () => GradeNodeId,
): ClipGrade | null {
  let grade = base ?? emptyGrade();
  try {
    for (const { name, values, limit } of look.corrections) {
      grade = insertLayer(grade, {}, newId(), {
        kind: "correct",
        input: { node: "source" },
        on: true,
        opacity: 1,
        name: `${look.name}: ${name}`,
        values: structuredClone(values),
        ...(limit ? { limit: structuredClone(limit) } : {}),
      });
    }
  } catch {
    return null;
  }
  return validateGrade(grade) === null ? grade : null;
}

/**
 * `base` with a whole grade `extra` added after everything it has: `extra`'s nodes under fresh ids
 * (every ref renamed through `gradeInputs` and `renameGradeKeys`), what read its source reading
 * `base`'s result, its result the new result. Positions are dropped (they would sit on top of
 * `base`'s) and `base`'s color space is kept. Null when `extra` has no nodes or the result is not
 * a valid grade.
 */
function withGrade(
  base: ClipGrade | null,
  extra: ClipGrade,
  newId: () => GradeNodeId,
): ClipGrade | null {
  const ids = Object.keys(extra.nodes);
  if (ids.length === 0) return null;
  const into = base ?? emptyGrade();
  const fresh = new Map(ids.map((id) => [id, newId()]));
  const rename = (id: GradeNodeId) => fresh.get(id) ?? id;
  const next = structuredClone(into);
  const point = (ref: { node: string; channel?: "r" | "g" | "b" }) => {
    if (ref.node === "source") {
      ref.node = into.out.node;
      if (into.out.channel) ref.channel = into.out.channel;
    } else ref.node = rename(ref.node);
  };
  for (const id of ids) {
    const node = structuredClone(extra.nodes[id]!);
    gradeInputs(node).forEach(point);
    renameGradeKeys(node, rename);
    delete node.pos;
    next.nodes[rename(id)] = node;
  }
  const out = structuredClone(extra.out);
  point(out);
  next.out = out;
  return validateGrade(next) === null ? next : null;
}

/** `base` with a look or a still's grade added at the bottom. Null as `withLook` / `withGrade`. */
export function addGrade(
  base: ClipGrade | null,
  extra: LookDef | ClipGrade,
  newId: () => GradeNodeId,
): ClipGrade | null {
  return "corrections" in extra ? withLook(base, extra, newId) : withGrade(base, extra, newId);
}

/**
 * What adding `extra` to `base` would draw, with node ids that depend only on the two (so the
 * same pair gives the same grade, and a thumbnail of it can be kept).
 */
export function previewGrade(base: ClipGrade | null, extra: LookDef | ClipGrade): ClipGrade | null {
  let n = 0;
  return addGrade(base, extra, () => `~look${n++}`);
}

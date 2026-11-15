import type { ClipGrade, Correction, GradeLimit, GradeNode, NodeRef } from "../project.types";
import {
  DEFAULT_CORRECTION,
  GRADE_RANGES,
  LIMIT_RANGES,
  UNSAFE_KEYS,
  WARPER_POINTS,
  correctionOf,
} from "./grade";

/** The pictures a node reads: its picture inputs, in order (none for a key join). */
export function gradeInputs(node: GradeNode): NodeRef[] {
  switch (node.kind) {
    case "correct":
    case "split":
      return [node.input];
    case "parallel":
    case "layer":
      return node.inputs;
    case "join":
      return [node.r, node.g, node.b];
    case "keyJoin":
      return [];
  }
}

/** The one list of the places a node names another node besides its pictures (the objects, not copies). */
function keyHolders(node: GradeNode): { from: string }[] {
  if (node.kind === "correct") {
    return node.limit?.from === undefined ? [] : [node.limit as { from: string }];
  }
  if (node.kind === "keyJoin") return node.keys;
  return [];
}

/** The nodes a node reads besides pictures: a correction's shared key, a key join's keys. */
export function gradeKeys(node: GradeNode): string[] {
  return keyHolders(node).map((holder) => holder.from);
}

/** Renames, in place, the nodes a node reads besides pictures (the ids `gradeKeys` lists). */
export function renameGradeKeys(node: GradeNode, rename: (id: string) => string): void {
  for (const holder of keyHolders(node)) holder.from = rename(holder.from);
}

/** Whether node `id` reads `of` through pictures or keys, or is it. Never throws, even on a cycle. */
export function gradeReads(grade: ClipGrade, id: string, of: string): boolean {
  const seen = new Set<string>();
  const stack = [id];
  for (let at = stack.pop(); at !== undefined; at = stack.pop()) {
    if (at === of) return true;
    const node = Object.hasOwn(grade.nodes, at) ? grade.nodes[at] : undefined;
    if (!node || seen.has(at)) continue;
    seen.add(at);
    stack.push(...gradeInputs(node).map((ref) => ref.node), ...gradeKeys(node));
  }
  return false;
}

/** The nodes whose picture `out` needs, read back through pictures (keys not followed). */
function picturePath(grade: ClipGrade): Set<string> {
  const found = new Set<string>();
  const stack = [grade.out.node];
  for (let at = stack.pop(); at !== undefined; at = stack.pop()) {
    const node = Object.hasOwn(grade.nodes, at) ? grade.nodes[at] : undefined;
    if (!node || found.has(at)) continue;
    found.add(at);
    stack.push(...gradeInputs(node).map((ref) => ref.node));
  }
  return found;
}

/**
 * Whether correction `id` may take its key from `from` by where it sits: `from` is above it (its
 * input reads it, through pictures or keys), or off the picture path (a node `out` doesn't read
 * as a picture: a key join, or a pick only Leader Seal wires). A pick from another on-path branch
 * (a sibling) is refused: ungrouping would put one below the other, a cycle.
 */
export function keyFromAbove(grade: ClipGrade, id: string, from: string): boolean {
  const node = Object.hasOwn(grade.nodes, id) ? grade.nodes[id] : undefined;
  if (node?.kind !== "correct") return false;
  return gradeReads(grade, node.input.node, from) || !picturePath(grade).has(from);
}

const isPlain = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** A warper point's index as stored: a whole number 0 to `WARPER_POINTS - 1`, written plainly. */
const isPointIndex = (key: string): boolean =>
  /^(0|[1-9][0-9]?)$/.test(key) && Number(key) < WARPER_POINTS;

/** What a warper point holds; every point has both. */
const WARPER_POINT = { dh: 0, ds: 0 };

/** A key the defaults don't have, or a value of another type than its default (at any depth), or null. */
function shapeProblem(id: string, values: unknown): string | null {
  const walk = (value: unknown, base: unknown, path: string): string | null => {
    const bad = (why: string) => `values.${path} of ${id} ${why}`;
    if (typeof base === "number") {
      if (typeof value !== "number" || !Number.isFinite(value)) return bad("must be a number");
      // Curve points sit in 0 to 1.
      if (path.startsWith("curves.") && (value < 0 || value > 1)) {
        return bad(`is ${value}, out of range (0 to 1)`);
      }
      return null;
    }
    if (typeof base === "boolean") {
      return typeof value === "boolean" ? null : bad("must be true or false");
    }
    if (Array.isArray(base)) {
      if (!Array.isArray(value)) return bad("must be a list");
      // Each element has the shape of the default's first (the pinned list is empty: indices).
      const template = base[0] ?? 0;
      for (const [i, cell] of value.entries()) {
        const here = `${path}[${i}]`;
        const problem = walk(cell, template, here);
        if (problem) return problem;
        if (
          path === "warper.pinned" &&
          !(Number.isInteger(cell) && (cell as number) >= 0 && (cell as number) < WARPER_POINTS)
        ) {
          return `values.${here} of ${id} must be a whole number from 0 to ${WARPER_POINTS - 1}`;
        }
      }
      // A row of a list of lists has as many cells as the default's; the matrix has its 3 rows.
      if (path.endsWith("]") && value.length !== base.length) {
        return bad(`must have ${base.length} cells`);
      }
      if (path === "mixer.matrix" && value.length !== base.length) {
        return bad(`must have ${base.length} rows`);
      }
      // Curve points: at least 2, x sorted from 0 to 1 (every default is built that way).
      if (path.startsWith("curves.") && !path.endsWith("]")) {
        if (value.length < 2) return bad("needs at least 2 points");
        const xs = (value as number[][]).map((point) => point[0]!);
        if (xs.some((x, i) => i > 0 && x <= xs[i - 1]!))
          return bad("must be sorted by x, increasing");
        if (xs[0] !== 0 || xs[xs.length - 1] !== 1) return bad("must run from x 0 to x 1");
      }
      return null;
    }
    if (!isPlain(value)) return bad("must be an object");
    for (const [key, inner] of Object.entries(value)) {
      const here = path === "" ? key : `${path}.${key}`;
      if (UNSAFE_KEYS.has(key)) return `values.${here} of ${id} is not a correction field`;
      if (path === "warper.points") {
        // Sparse offsets by grid index, each a whole { dh, ds }.
        if (!isPointIndex(key)) {
          return `values.${here} of ${id} is not a grid index (0 to ${WARPER_POINTS - 1})`;
        }
        const problem = walk(inner, WARPER_POINT, here);
        if (problem) return problem;
        if (!Object.hasOwn(inner as object, "dh") || !Object.hasOwn(inner as object, "ds")) {
          return `values.${here} of ${id} needs both dh and ds`;
        }
        continue;
      }
      const known = isPlain(base) && Object.hasOwn(base, key) ? base[key] : undefined;
      if (known === undefined) return `values.${here} of ${id} is not a correction field`;
      const problem = walk(inner, known, here);
      if (problem) return problem;
    }
    return null;
  };
  return walk(values, DEFAULT_CORRECTION, "");
}

function rangeProblem(id: string, node: Correction): string | null {
  const walk = (value: unknown, path: string): string | null => {
    if (typeof value === "number") {
      const range = GRADE_RANGES[path];
      if (!Number.isFinite(value)) return `${path} of ${id} is not a number`;
      if (range && (value < range.min || value > range.max)) {
        return `${path} of ${id} is ${value}, out of range (${range.min} to ${range.max})`;
      }
      return null;
    }
    if (Array.isArray(value)) {
      // Curves hold points that are not ranged; the matrix is ranged as a whole.
      if (path !== "mixer.matrix") return null;
      for (const row of value as number[][]) {
        for (const cell of row) {
          const problem = walk(cell, path);
          if (problem) return problem;
        }
      }
      return null;
    }
    if (typeof value === "object" && value !== null) {
      if (path === "warper.points") {
        // Every point is ranged alike, whatever its index.
        for (const point of Object.values(value as Record<string, { dh: number; ds: number }>)) {
          const problem = walk(point.dh, `${path}.dh`) || walk(point.ds, `${path}.ds`);
          if (problem) return problem;
        }
        return null;
      }
      for (const [key, inner] of Object.entries(value)) {
        const problem = walk(inner, path === "" ? key : `${path}.${key}`);
        if (problem) return problem;
      }
    }
    return null;
  };
  return walk(correctionOf(node), "");
}

/**
 * A limit's number out of `LIMIT_RANGES`, or a pair whose ends are the wrong way round (all but
 * the hue, which wraps), or null.
 */
function limitProblem(id: string, limit: GradeLimit): string | null {
  const parts = { color: limit.color, brightness: limit.brightness, refine: limit.refine };
  for (const [part, fields] of Object.entries(parts)) {
    if (!fields) continue;
    for (const [field, value] of Object.entries(fields)) {
      const range = LIMIT_RANGES[`${part}.${field}`];
      if (!range) continue;
      const path = `limit.${part}.${field}`;
      const ends = Array.isArray(value) ? (value as number[]) : [value as number];
      for (const end of ends) {
        if (!(end >= range.min && end <= range.max)) {
          return `${path} of ${id} is ${end}, out of range (${range.min} to ${range.max})`;
        }
      }
      if (ends.length === 2 && field !== "hue" && ends[0]! > ends[1]!) {
        return `${path} of ${id} runs backwards (${ends[0]} to ${ends[1]})`;
      }
    }
  }
  return null;
}

/**
 * What is wrong with a grade, or null: a ref to a node that is not there, a picture ref (an
 * input or `out`) naming a key join, a cycle, an `out` that
 * does not come from the source, a channel ref not from a split, a join with fewer than two
 * inputs or with `blends` not matching its inputs, a `limit.from` that is missing, not a
 * correction or key join, makes a cycle, or names a node on the picture path that isn't above it
 * (`keyFromAbove`), an opacity or strength outside 0 to 1, a value of a
 * correction that is not a field or has another type than its default, a value outside its
 * range (`GRADE_RANGES`), and a limit's number outside `LIMIT_RANGES` or a pair running backwards.
 */
export function validateGrade(grade: ClipGrade): string | null {
  const { nodes } = grade;
  const check = (ref: NodeRef, who: string): string | null => {
    if (ref.node === "source") {
      return ref.channel ? `${who} takes a channel of the source, which is not a split` : null;
    }
    const target = Object.hasOwn(nodes, ref.node) ? nodes[ref.node] : undefined;
    if (!target) return `${who} reads missing node "${ref.node}"`;
    if (target.kind === "keyJoin") {
      return `${who} reads key join "${ref.node}" as a picture; a key join has a key, not a picture from the source`;
    }
    if (ref.channel && target.kind !== "split") {
      return `${who} takes a channel of "${ref.node}", which is not a split`;
    }
    return null;
  };
  const ids = Object.keys(nodes);
  for (const id of ids) {
    const node = nodes[id]!;
    for (const ref of gradeInputs(node)) {
      const problem = check(ref, `node "${id}"`);
      if (problem) return problem;
    }
    for (const from of gradeKeys(node)) {
      const target = Object.hasOwn(nodes, from) ? nodes[from] : undefined;
      if (!target) return `node "${id}" reads missing node "${from}"`;
      if (target.kind !== "correct" && target.kind !== "keyJoin") {
        return `node "${id}" takes its key from "${from}", which is not a correction or key join`;
      }
    }
    if ((node.kind === "parallel" || node.kind === "layer") && node.inputs.length < 2) {
      return `join "${id}" needs at least two inputs`;
    }
    if (node.kind === "layer" && node.blends.length !== node.inputs.length) {
      return `layer "${id}" needs one blends entry per input`;
    }
    // Written so NaN fails too.
    if ("opacity" in node && !(node.opacity >= 0 && node.opacity <= 1)) {
      return `opacity of ${id} is out of range (0 to 1)`;
    }
    if (node.kind === "correct") {
      if (node.lut && !(node.lut.strength >= 0 && node.lut.strength <= 1)) {
        return `lut strength of ${id} is out of range (0 to 1)`;
      }
      const problem =
        (node.values && shapeProblem(id, node.values)) ||
        rangeProblem(id, node) ||
        (node.limit && limitProblem(id, node.limit));
      if (problem) return problem;
    }
  }
  const outProblem = check(grade.out, "out");
  if (outProblem) return outProblem;

  // Cycles, through pictures and keys alike.
  const state = new Map<string, 1 | 2>();
  const visit = (id: string): boolean => {
    if (state.get(id) === 2) return false;
    if (state.get(id) === 1) return true;
    state.set(id, 1);
    const node = nodes[id]!;
    const next = [...gradeInputs(node).map((ref) => ref.node), ...gradeKeys(node)];
    for (const to of next) if (to !== "source" && visit(to)) return true;
    state.set(id, 2);
    return false;
  };
  for (const id of ids) if (visit(id)) return "the grade has a cycle";

  // A shared key comes from above, or from off the picture path.
  for (const id of ids) {
    const node = nodes[id]!;
    const from = node.kind === "correct" ? node.limit?.from : undefined;
    if (from !== undefined && !keyFromAbove(grade, id, from)) {
      return `node "${id}" takes its key from "${from}", which is not above it`;
    }
  }

  // Out comes from the source through pictures.
  const reaches = new Map<string, boolean>();
  const fromSource = (ref: NodeRef): boolean => {
    if (ref.node === "source") return true;
    const known = reaches.get(ref.node);
    if (known !== undefined) return known;
    const found = gradeInputs(nodes[ref.node]!).some(fromSource);
    reaches.set(ref.node, found);
    return found;
  };
  if (!fromSource(grade.out)) return "out is not reached from the source";
  return null;
}

import type { Correction, GradeLimit } from "../project.types";
import { GRADE_RANGES, LIMIT_RANGES, correctionOf } from "./grade";

/** The first number of a correction that is not finite or is outside its range (`GRADE_RANGES`), or null. */
export function rangeProblem(id: string, node: Correction): string | null {
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
export function limitProblem(id: string, limit: GradeLimit): string | null {
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

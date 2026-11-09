import type { Micros } from "@/core";
import type { MixProblem } from "../sound.delivery.types";

/**
 * The problems of an analysis as one row per spot. A clipped stretch always lies inside a peak
 * stretch, so the two overlap: stretches that touch or overlap are one spot, earliest first. A spot
 * shows its worst kind (`clipped` over `peak`) and the highest level of that kind.
 */
export function groupProblems(problems: readonly MixProblem[]): MixProblem[] {
  const sorted = [...problems].sort((a, b) => a.at - b.at);
  const spots: MixProblem[] = [];
  let end: Micros = 0;
  for (const problem of sorted) {
    const last = spots[spots.length - 1];
    if (!last || problem.at > end) {
      spots.push({ ...problem });
      end = problem.at + problem.duration;
      continue;
    }
    end = Math.max(end, problem.at + problem.duration);
    last.duration = end - last.at;
    if (problem.kind === last.kind) last.level = Math.max(last.level, problem.level);
    else if (problem.kind === "clipped") {
      last.kind = "clipped";
      last.level = problem.level;
    }
  }
  return spots;
}

/** A time into the mix for people: `0:42`, `1:05:09` past an hour. */
export function spotTime(at: Micros): string {
  const total = Math.floor(at / 1_000_000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, "0");
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${seconds}`;
  return `${minutes}:${seconds}`;
}

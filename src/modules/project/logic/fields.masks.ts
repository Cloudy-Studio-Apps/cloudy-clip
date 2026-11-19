import type { Draft } from "immer";
import { MARKER_COLORS, MASK_RANGES } from "../project.types";
import type { Clip, ClipMask, ProjectState } from "../project.types";

const MODES = ["add", "subtract", "intersect", "difference"];

function inRange(name: string, value: unknown): boolean {
  const range = MASK_RANGES[name]!;
  return typeof value === "number" && value >= range.min && value <= range.max;
}

function maskInRange(mask: ClipMask): boolean {
  const s = mask.shape;
  const numbers: Array<[string, unknown]> = [
    ["opacity", mask.opacity],
    ["feather", mask.feather],
    ["expansion", mask.expansion],
    ["x", mask.x],
    ["y", mask.y],
  ];
  if (s.kind === "rectangle")
    numbers.push(["width", s.width], ["height", s.height], ["roundness", s.roundness]);
  if (s.kind === "ellipse" || s.kind === "heart")
    numbers.push(["width", s.width], ["height", s.height]);
  if (s.kind === "star") {
    numbers.push(
      ["width", s.width],
      ["height", s.height],
      ["points", s.points],
      ["inner", s.inner],
    );
  }
  if (s.kind === "mirror") numbers.push(["width", s.width]);
  if (s.kind === "path") numbers.push(["scale", s.scale]);
  return (
    numbers.every(([name, value]) => inRange(name, value)) &&
    Number.isFinite(mask.rotation) &&
    MODES.includes(mask.mode) &&
    (MARKER_COLORS as readonly string[]).includes(mask.color)
  );
}

/** A clip's masks or matte that the document can't hold, if any. */
export function maskProblem(state: ProjectState): string | null {
  for (const clip of Object.values(state.clips) as Clip[]) {
    if (!clip.masks && !clip.maskOrder && !clip.matte) continue;
    const home = state.tracks[clip.trackId];
    if (home?.kind === "audio") return "an audio clip would have masks";
    const ids = Object.keys(clip.masks ?? {});
    const order = clip.maskOrder ?? [];
    if (
      order.length !== ids.length ||
      new Set(order).size !== order.length ||
      !order.every((id) => clip.masks?.[id])
    ) {
      return "a clip's mask order would not match its masks";
    }
    for (const mask of Object.values(clip.masks ?? {})) {
      if (!maskInRange(mask)) return "a mask would be out of range";
      const s = mask.shape;
      if (s.kind !== "path") continue;
      const ids = Object.keys(s.points);
      if (s.pointOrder.length < 3) return "a mask path would have fewer than three points";
      if (
        s.pointOrder.length !== ids.length ||
        new Set(s.pointOrder).size !== ids.length ||
        !s.pointOrder.every((id) => s.points[id])
      ) {
        return "a mask path's point order would not match its points";
      }
    }
    if (!clip.matte) continue;
    const matte = state.tracks[clip.matte.trackId];
    if (!matte) return "a matte would name a missing track";
    if (matte.compositionId !== home?.compositionId) {
      return "a matte would name a track of another composition";
    }
    if (matte.kind === "audio") return "a matte would name an audio track";
  }
  return null;
}

/** A deleted track no longer mattes anything: its clips lose the `matte` naming it. */
export function dropDeletedMattes(draft: Draft<ProjectState>): void {
  for (const clip of Object.values(draft.clips)) {
    if (clip.matte && !draft.tracks[clip.matte.trackId]) delete clip.matte;
  }
}

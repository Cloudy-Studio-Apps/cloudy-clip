import {
  maskLine,
  maskOutline,
  type ClipMask,
  type MaskMapping,
  type ProjectFormat,
  type Vec2,
} from "@/modules/project";
import { presetHandles } from "../logic/handles";
import { frameLength, placeLocal, toFrame, turn } from "../logic/mapping";

const pt = (p: Vec2) => `${p.x},${p.y}`;

/** A spot in the frame (output px from its center) as CSS `left`/`top` percentages. */
export function spot(p: Vec2, format: ProjectFormat) {
  return {
    left: `${((p.x + format.width / 2) / format.width) * 100}%`,
    top: `${((p.y + format.height / 2) / format.height) * 100}%`,
  };
}

/**
 * A mask's outline as an SVG `d` in frame px: its Béziers mapped into the frame (a Bézier maps
 * exactly under the mapping), or for linear and mirror their line(s), long enough to cross the frame.
 */
export function outlineData(mask: ClipMask, m: MaskMapping, format: ProjectFormat): string {
  const f = (p: Vec2) => pt(toFrame(m, p));
  const outline = maskOutline(mask);
  if (outline) {
    const first = outline[0];
    if (!first) return "";
    return `M${f(first[0])}${outline.map(([, a, b, end]) => ` C${f(a)} ${f(b)} ${f(end)}`).join("")} Z`;
  }
  const line = maskLine(mask);
  if (!line) return "";
  const reach =
    (2 * Math.hypot(format.width, format.height)) / frameLength(m, mask, { x: 1, y: 0 });
  const dir = turn({ x: reach, y: 0 }, mask.rotation);
  const along = (off: number) => {
    const c = { x: line.x + line.nx * off, y: line.y + line.ny * off };
    return `M${f({ x: c.x - dir.x, y: c.y - dir.y })} L${f({ x: c.x + dir.x, y: c.y + dir.y })}`;
  };
  return line.half > 0 ? `${along(-line.half)} ${along(line.half)}` : along(0);
}

/** A preset's box (its width × height, turned) as an SVG `d` in frame px; empty for other kinds. */
export function boxData(mask: ClipMask, m: MaskMapping): string {
  const s = mask.shape;
  if (!("height" in s)) return "";
  const corner = (dx: number, dy: number) =>
    pt(toFrame(m, placeLocal(mask, { x: (dx * s.width) / 2, y: (dy * s.height) / 2 })));
  return `M${corner(-1, -1)} L${corner(1, -1)} L${corner(1, 1)} L${corner(-1, 1)} Z`;
}

/**
 * Redraws the selected preset mask straight on the DOM for `mask` while a drag runs (no React
 * renders): its outline, its box and each handle.
 */
export function paintMask(
  root: HTMLElement,
  mask: ClipMask,
  m: MaskMapping,
  format: ProjectFormat,
): void {
  const d = outlineData(mask, m, format);
  root.querySelectorAll("[data-mask-line]").forEach((line) => line.setAttribute("d", d));
  root.querySelector("[data-mask-box]")?.setAttribute("d", boxData(mask, m));
  for (const handle of presetHandles(mask, m)) {
    const el = root.querySelector<HTMLElement>(`[data-mask-handle="${handle.id}"]`);
    if (el) Object.assign(el.style, spot(toFrame(m, handle.at), format));
  }
}

/** The mask overlay's root, which covers the frame exactly. */
export const overlayOf = (from: Element) => from.closest<HTMLElement>("[data-mask-overlay]");

/** Whether a key goes to a text field (which keeps Delete and Escape for itself). */
export const isTextField = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

import { SEAL_ART } from "./seal.art";

/** A heart centered on (x, y), about `s` units from its center to its sides. */
export function heartPath(x: number, y: number, s: number): string {
  const p = (dx: number, dy: number) => `${x + dx * s} ${y + dy * s}`;
  return `M${p(0, -0.35)}C${p(-0.55, -1.05)} ${p(-1.35, -0.25)} ${p(-1, 0.25)}L${p(0, 1)}L${p(1, 0.25)}C${p(1.35, -0.25)} ${p(0.55, -1.05)} ${p(0, -0.35)}Z`;
}

export function heart(x: number, y: number, s: number, color: string = SEAL_ART.red): string {
  return `<path d="${heartPath(x, y, s)}" fill="${color}" stroke="${SEAL_ART.ink}" stroke-width="2.5"/>`;
}

/** A four-pointed sparkle centered on (x, y). */
export function sparkle(x: number, y: number, r: number, color: string = SEAL_ART.yellow): string {
  const d = `M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}Z`;
  return `<path d="${d}" fill="${color}" stroke="${SEAL_ART.ink}" stroke-width="1.5"/>`;
}

/** A tear drop hanging from (x, y). */
export function drop(x: number, y: number, s: number, color: string = SEAL_ART.tear): string {
  const d = `M${x} ${y}C${x + s * 0.4} ${y + s * 0.6} ${x + s * 0.6} ${y + s} ${x} ${y + s * 1.25}C${x - s * 0.6} ${y + s} ${x - s * 0.4} ${y + s * 0.6} ${x} ${y}Z`;
  return `<path d="${d}" fill="${color}" stroke="${SEAL_ART.ink}" stroke-width="2"/>`;
}

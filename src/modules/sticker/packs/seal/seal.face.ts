import type { SealFace } from "../../sticker.types";
import { SEAL_ART } from "./seal.art";

const { ink, furTop, furBottom, spot, pink, muzzle } = SEAL_ART;

const SPOTS: [cx: number, cy: number, rx: number, ry: number][] = [
  [44, 44, 3, 2],
  [57, 39, 2.2, 1.5],
  [74, 40, 3.2, 2.1],
  [88, 47, 2.4, 1.8],
  [33, 54, 2, 1.5],
];

const DEFS =
  `<linearGradient id="fur" x1="0" y1="0" x2="0" y2="1">` +
  `<stop offset="0" stop-color="${furTop}"/><stop offset="0.8" stop-color="${furBottom}"/></linearGradient>`;

/** The head every expression shares: fur, spots, cheeks, muzzle and nose. */
function head(blush: number): string {
  const spots = SPOTS.map(
    ([cx, cy, rx, ry]) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${spot}"/>`,
  ).join("");
  return (
    `<ellipse cx="64" cy="70" rx="44" ry="38" fill="url(#fur)" stroke="${ink}" stroke-width="3.5"/>` +
    spots +
    `<ellipse cx="36" cy="81" rx="7" ry="4.2" fill="${pink}" opacity="${blush}"/>` +
    `<ellipse cx="92" cy="81" rx="7" ry="4.2" fill="${pink}" opacity="${blush}"/>` +
    `<path d="M64 80c-2-3.2-11.2-3.2-12 2.8-.6 4.8 5.2 6.8 8.8 5.2 1.6-.6 2.6-1.6 3.2-2.6.6 1 1.6 2 3.2 2.6 3.6 1.6 9.4-.4 8.8-5.2-.8-6-10-6-12-2.8z" fill="${muzzle}" stroke="${ink}" stroke-width="2.6"/>` +
    `<ellipse cx="64" cy="79.6" rx="4" ry="2.7" fill="${ink}"/>`
  );
}

/**
 * Wraps artwork drawn on the 128-unit grid as a sticker: a white die-cut edge that follows its
 * outline, with a soft shadow.
 */
function dieCut(art: string, defs: string): string {
  const { edge, shadow, white } = SEAL_ART;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -8 144 144" width="512" height="512">` +
    `<defs>${defs}<filter id="cut" x="-10%" y="-10%" width="120%" height="120%">` +
    `<feMorphology in="SourceAlpha" operator="dilate" radius="${edge}" result="grown"/>` +
    `<feFlood flood-color="${white}"/><feComposite in2="grown" operator="in" result="edge"/>` +
    `<feDropShadow in="edge" dx="0" dy="1.5" stdDeviation="1.5" flood-color="${shadow}" flood-opacity="0.28" result="sticker"/>` +
    `<feMerge><feMergeNode in="sticker"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>` +
    `<g filter="url(#cut)" stroke-linecap="round" stroke-linejoin="round">${art}</g></svg>`
  );
}

/** A "foca watona" sticker with the given expression, as SVG markup. */
export function sealSvg(face: SealFace): string {
  const { eyes, mouth = "", back = "", front = "", blush = 0.75 } = face;
  return dieCut(back + head(blush) + mouth + eyes + front, DEFS);
}

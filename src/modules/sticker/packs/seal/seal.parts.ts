import { SEAL_ART } from "./seal.art";

const { ink, white, mouth, tongue } = SEAL_ART;

const line = (d: string, width = 3.5, color: string = ink) =>
  `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}"/>`;

/** An open eye with a shine, centered on (x, y). */
function eye(x: number, y: number, rx = 4.2, ry = 5.2): string {
  return (
    `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${ink}"/>` +
    `<circle cx="${x + rx * 0.35}" cy="${y - ry * 0.4}" r="${Math.max(1.4, rx * 0.38)}" fill="${white}"/>`
  );
}

/** Eye positions on the head. */
export const SEAL_EYE_LEFT = { x: 46, y: 64 } as const;
export const SEAL_EYE_RIGHT = { x: 82, y: 64 } as const;

const L = SEAL_EYE_LEFT;
const R = SEAL_EYE_RIGHT;

/** Eyes (with brows where the mood needs them). */
export const SEAL_EYES = {
  open: eye(L.x, L.y) + eye(R.x, R.y),
  big:
    eye(L.x, L.y, 5.6, 6.8) + eye(R.x, R.y, 5.6, 6.8) + line("M38 51q8-6 16-1M74 50q8-5 16 1", 3),
  happy: line(`M${L.x - 7} 66q7-8 14 0M${R.x - 7} 66q7-8 14 0`),
  squeezed: line("M40 58l10 6-10 6M88 58l-10 6 10 6"),
  sleepy: line(`M${L.x - 7} 63q7 6 14 0M${R.x - 7} 63q7 6 14 0`),
  wink: line(`M${L.x - 7} 66q7-8 14 0`) + eye(R.x, R.y),
  sad: eye(L.x, 66, 3.8, 4.6) + eye(R.x, 66, 3.8, 4.6) + line("M37 57l13-5M78 52l13 5", 3),
  crying:
    line(`M${L.x - 7} 64q7 5 14 0M${R.x - 7} 64q7 5 14 0`) + line("M37 54l13-5M78 49l13 5", 3),
  angry: eye(L.x, 66, 3.6, 4.2) + eye(R.x, 66, 3.6, 4.2) + line("M37 52l14 7M77 59l14-7", 3.5),
  lookingUp: eye(49, 61, 3.8, 4.8) + eye(85, 61, 3.8, 4.8) + line("M77 49q7-5 14-1", 3),
} as const;

/** Mouths, drawn under the muzzle. */
export const SEAL_MOUTHS = {
  smile: line("M57 92q7 6 14 0", 3),
  open:
    `<path d="M55 91h18q0 12-9 12t-9-12z" fill="${mouth}" stroke="${ink}" stroke-width="3"/>` +
    `<path d="M58.5 98.5q5.5-4 11 0q-1.5 4-5.5 4t-5.5-4z" fill="${tongue}"/>`,
  frown: line("M57 97q7-6 14 0", 3),
  oh: `<ellipse cx="64" cy="96" rx="4.5" ry="5.5" fill="${mouth}" stroke="${ink}" stroke-width="3"/>`,
  wobbly: line("M55 96q2.25-3 4.5 0t4.5 0 4.5 0 4.5 0", 3),
  smirk: line("M58 94q7 3 12-3", 3),
  tongue: `<path d="M60 88q0 10 4 10t4-10z" fill="${tongue}" stroke="${ink}" stroke-width="2.5"/>`,
} as const;

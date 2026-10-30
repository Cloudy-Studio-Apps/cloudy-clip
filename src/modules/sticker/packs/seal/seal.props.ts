import { SEAL_ART } from "./seal.art";
import { drop, heart, sparkle } from "./seal.shapes";

const { ink, white, red, yellow, blue, green, violet, furTop, tear } = SEAL_ART;

/** A flipper (an ellipse) centered on (x, y), tilted by `angle` degrees. */
function flipper(x: number, y: number, angle: number): string {
  return `<ellipse cx="${x}" cy="${y}" rx="8.5" ry="15" transform="rotate(${angle} ${x} ${y})" fill="${furTop}" stroke="${ink}" stroke-width="3.2"/>`;
}

/** Props and effects drawn around the seal's head. */
export const SEAL_PROPS = {
  hearts: heart(104, 28, 10) + heart(118, 48, 5.5),
  laughTears: drop(25, 58, 10) + drop(103, 58, 10),
  tearStreams:
    `<path d="M43 69q-3 16-6 34M85 69q3 16 6 34" fill="none" stroke="${tear}" stroke-width="6" opacity="0.95"/>` +
    drop(38, 100, 7) +
    drop(91, 100, 7),
  sunglasses:
    `<path d="M33 57h25q0 14-12.5 14T33 57zM70 57h25q0 14-12.5 14T70 57z" fill="${ink}" stroke="${ink}" stroke-width="2"/>` +
    `<path d="M58 59h12M33 57l-9-4M95 57l9-4" fill="none" stroke="${ink}" stroke-width="3"/>` +
    `<path d="M38 60l6 0M75 60l6 0" stroke="${white}" stroke-width="2.5" opacity="0.7"/>`,
  partyHat:
    `<path d="M42 38L68 31L50 8Z" fill="${violet}" stroke="${ink}" stroke-width="3"/>` +
    `<path d="M47 22l11-3M44 30l18-5" stroke="${yellow}" stroke-width="3"/>` +
    `<circle cx="50" cy="9" r="5.5" fill="${yellow}" stroke="${ink}" stroke-width="2.5"/>`,
  confetti:
    `<rect x="98" y="18" width="6" height="10" rx="1" transform="rotate(25 101 23)" fill="${blue}" stroke="${ink}" stroke-width="1.5"/>` +
    `<rect x="110" y="40" width="6" height="10" rx="1" transform="rotate(-30 113 45)" fill="${red}" stroke="${ink}" stroke-width="1.5"/>` +
    `<rect x="14" y="44" width="6" height="10" rx="1" transform="rotate(-20 17 49)" fill="${green}" stroke="${ink}" stroke-width="1.5"/>` +
    sparkle(86, 16, 6),
  zzz:
    `<path d="M94 14h14l-14 14h14" fill="none" stroke="${ink}" stroke-width="3.5"/>` +
    `<path d="M82 34h9l-9 9h9" fill="none" stroke="${ink}" stroke-width="3"/>`,
  thoughtBubbles:
    `<circle cx="99" cy="38" r="3.5" fill="${white}" stroke="${ink}" stroke-width="2.5"/>` +
    `<circle cx="107" cy="27" r="5" fill="${white}" stroke="${ink}" stroke-width="2.5"/>` +
    `<circle cx="113" cy="13" r="6.5" fill="${white}" stroke="${ink}" stroke-width="2.5"/>`,
  angerMark: `<path d="M99 25q6 4 12 0M99 39q6-4 12 0M98 26q4 6 0 12M112 26q-4 6 0 12" fill="none" stroke="${red}" stroke-width="3.5"/>`,
  exclamation:
    `<path d="M110 10v15" stroke="${red}" stroke-width="5.5"/>` +
    `<circle cx="110" cy="33" r="3" fill="${red}"/>`,
  approveFlipper: flipper(104, 92, -28) + sparkle(116, 62, 7),
  raisedFlippers: flipper(18, 54, -55) + flipper(110, 54, 55),
  yaySparkles: sparkle(12, 20, 7) + sparkle(116, 18, 7) + sparkle(64, 14, 5),
  winkSparkle: sparkle(104, 46, 6),
  sweat: drop(102, 40, 9),
} as const;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** A size as a ratio: `9:16`. */
export function ratioLabel(width: number, height: number): string {
  const divisor = gcd(width, height) || 1;
  return `${width / divisor}:${height / divisor}`;
}

/** How long ago: `2h ago`, `yesterday`, `Oct 21`. */
export function agoLabel(time: number, now: number): string {
  const elapsed = now - time;
  if (elapsed < MINUTE) return "just now";
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}m ago`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}h ago`;
  if (elapsed < 2 * DAY) return "yesterday";
  return new Date(time).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

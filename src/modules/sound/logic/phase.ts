/** Left and right agree enough to fold to mono without losing the mix: no cancelling. */
export function monoSafe(correlation: number): boolean {
  return correlation >= 0;
}

/** A correlation for people: `+0.72`, `−0.30`. */
export function formatCorrelation(correlation: number): string {
  const text = Math.abs(correlation).toFixed(2);
  if (Number(text) === 0) return "0.00";
  return `${correlation < 0 ? "−" : "+"}${text}`;
}

/** Where a correlation falls across the meter, 0 (−1) to 1 (+1). */
export function correlationX(correlation: number): number {
  return (Math.min(1, Math.max(-1, correlation)) + 1) / 2;
}

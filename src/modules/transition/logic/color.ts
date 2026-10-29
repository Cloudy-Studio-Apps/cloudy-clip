/** `#rrggbb` (or `#rgb`) as `rgba(...)` with `alpha`; unparsable input becomes white. */
export function withAlpha(hex: string, alpha: number): string {
  let h = hex.replace("#", "");
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  const n = /^[0-9a-fA-F]{6}/.test(h) ? parseInt(h.slice(0, 6), 16) : 0xffffff;
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${Math.min(1, Math.max(0, alpha))})`;
}
